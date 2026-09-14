-- CRACK 0008: RLS hardening — production security hotfix.
--
-- Closes five holes found by the 2026-09-13 audit, all of which were
-- exploitable on the live site by anyone holding the (public, by design)
-- anon key plus an anonymous session:
--
--   S1  PRIVILEGE ESCALATION. "profiles update self" restricted the row
--       but not the columns, so a single PostgREST
--       `PATCH /profiles?id=eq.<self> {"is_admin": true}` promoted any
--       player to admin, which opens the whole validation_reviews queue
--       (read + resolve) via the policies in 0002.
--
--   S2  PROFILE ENUMERATION. "profiles read all" was
--       `using (auth.role() = 'authenticated')`, and anonymous sessions
--       count as authenticated, so `select id, display_name, is_admin
--       from profiles` dumped every player — including which ids are
--       admins, i.e. a target list for S1.
--
--   S3  MID-PHASE ROOM JOIN. "rp insert self" had no phase check, so a
--       client could insert itself into any room at any time, including
--       one already in 'playing' or 'validating'.
--
--   S4  ANSWER LEAKAGE. S3 + "sub read scoped" (membership + phase in
--       validating/results) meant a mid-phase joiner could read every
--       player's answers. The read policy was correct; the membership
--       it trusted was not.
--
--   S5  SCORE DILUTION. "sub insert self" checked only
--       `auth.uid() = player_id` — no membership, no phase. A client
--       could inject rows into any room, and compute_room_scores (0006)
--       downgrades any answer duplicated on the same row_index from 10
--       points to 5. Injecting copies of everyone's answers halved the
--       whole table's score.
--
-- Also fixed here because it is the same defect class and one policy:
--   S6  REVIEW SPOOFING. "reviews insert any" was `with check (true)`,
--       so player_id could be set to any enumerated profile id (making
--       the victim the apparent author, and tripping the 0005 rate-limit
--       trigger against them), and status / reviewed_* / resolution_*
--       could be pre-set to write fake "already approved" history.
--
-- NOT fixed here, deliberately: `rooms` SELECT is still `using (true)`
-- (0006_revert restored it for the anonymous deep-link join flow), so
-- room codes remain enumerable. After this migration that only permits
-- joining a room while it is in 'lobby', where the joiner is visible in
-- the player list before the host starts. Closing it properly needs a
-- find_room_by_code RPC plus a client rewire of useRoom's initial load
-- (the RPC is created below so the follow-up needs no new migration).
--
-- Shipping alongside: 0006_revert_rooms_read_to_public.sql is renamed to
-- 0009_. It shared the `0006` prefix with
-- 0006_finalize_round_and_scoring_fixes.sql, and the CLI derives a
-- migration's version from that prefix, so replaying both violated the
-- primary key on supabase_migrations.schema_migrations and the schema
-- could not be stood up locally at all. Only 0001, 0005 and the renamed
-- file touch the `rooms` SELECT policy, so running the revert last
-- produces an identical final schema. Content is untouched.
--
-- Client changes that ship WITH this migration (see the same commit):
--   * roomService.joinRoom uses ON CONFLICT DO NOTHING, so a re-join of
--     an existing membership never takes the UPDATE path (room_players
--     has no UPDATE policy, by design).
--   * Room.tsx only leaves a room from the 'lobby' phase, so a refresh
--     mid-round no longer deletes the membership this migration now
--     requires to re-create. (It also fixes a live bug: closing the tab
--     during a round removed you from everyone else's leaderboard.)
--   * Room.tsx flushes pending autosaves at T-1s and silences the
--     write error on the post-buzzer flush, which RLS now rejects.

-- ---------------------------------------------------------------------
-- S1 — profiles: column privileges + trigger guard
-- ---------------------------------------------------------------------

-- Supabase grants table-level ALL on public tables to anon/authenticated.
-- Postgres column privileges are ADDITIVE to table privileges: revoking
-- `update (is_admin)` while the table-level UPDATE grant stands is a
-- no-op. The table grant has to go first, then the one column we want
-- clients to write comes back.
revoke update on public.profiles from anon, authenticated;
grant  update (display_name) on public.profiles to authenticated;

-- Defense in depth: even if a future migration re-grants UPDATE broadly,
-- the privileged columns stay server-only. auth.role() is NULL in the
-- SQL editor and in service_role contexts, so the documented
-- `update public.profiles set is_admin = true where id = '…'`
-- admin-promotion flow in README.md keeps working.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'is_admin cannot be changed by the client';
    end if;
    if new.id is distinct from old.id then
      raise exception 'id cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------
-- S2 — profiles: read yourself, and the people you're in a room with
-- ---------------------------------------------------------------------

-- SECURITY DEFINER so the inner reads bypass room_players' own RLS —
-- same reason is_room_member() exists (see 0004): a policy on T that
-- references T recurses.
create or replace function public.shares_room_with(p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_players mine
    join public.room_players theirs on theirs.room_id = mine.room_id
    where mine.player_id = auth.uid()
      and theirs.player_id = p_other
  );
$$;

drop policy if exists "profiles read all" on public.profiles;
drop policy if exists "profiles read self or co-member" on public.profiles;
create policy "profiles read self or co-member" on public.profiles for select
  using (
    auth.uid() = id
    or public.shares_room_with(id)
  );

-- ---------------------------------------------------------------------
-- S3 — room_players: you may only join a room that is still in the lobby
-- ---------------------------------------------------------------------

drop policy if exists "rp insert self" on public.room_players;
create policy "rp insert self" on public.room_players for insert
  with check (
    auth.uid() = player_id
    and exists (
      select 1 from public.rooms r
      where r.id = room_players.room_id
        and r.phase = 'lobby'
    )
  );

-- ---------------------------------------------------------------------
-- S4 / S5 — submissions: must be a member, and only during 'playing'
-- ---------------------------------------------------------------------

drop policy if exists "sub insert self" on public.submissions;
create policy "sub insert self" on public.submissions for insert
  with check (
    auth.uid() = player_id
    and public.is_room_member(submissions.room_id)
    and exists (
      select 1 from public.rooms r
      where r.id = submissions.room_id and r.phase = 'playing'
    )
  );

-- The phase clause also closes post-hoc editing: previously a player
-- could read everyone's answers during 'validating' and then rewrite
-- their own rows to match the good ones.
drop policy if exists "sub update self" on public.submissions;
create policy "sub update self" on public.submissions for update
  using (auth.uid() = player_id)
  with check (
    auth.uid() = player_id
    and public.is_room_member(submissions.room_id)
    and exists (
      select 1 from public.rooms r
      where r.id = submissions.room_id and r.phase = 'playing'
    )
  );

-- ---------------------------------------------------------------------
-- S5 (cont.) — votes: must be a member, and the submission must belong
-- to the room you claim to be voting in
-- ---------------------------------------------------------------------

-- 0005 checked voter_id, the room phase, and "not my own submission",
-- but never that the voter was in the room or that votes.room_id and
-- submissions.room_id agreed — so a non-member could vote anywhere, and
-- a member could aim a vote at a submission in a different room.
drop policy if exists "votes insert self" on public.votes;
create policy "votes insert self" on public.votes for insert
  with check (
    auth.uid() = voter_id
    and public.is_room_member(votes.room_id)
    and exists (
      select 1 from public.rooms r
      where r.id = votes.room_id and r.phase = 'validating'
    )
    and exists (
      select 1 from public.submissions s
      where s.id = votes.submission_id
        and s.room_id = votes.room_id
        and s.player_id <> auth.uid()
    )
  );

drop policy if exists "votes update self" on public.votes;
create policy "votes update self" on public.votes for update
  using (auth.uid() = voter_id)
  with check (
    auth.uid() = voter_id
    and public.is_room_member(votes.room_id)
    and exists (
      select 1 from public.rooms r
      where r.id = votes.room_id and r.phase = 'validating'
    )
    and exists (
      select 1 from public.submissions s
      where s.id = votes.submission_id
        and s.room_id = votes.room_id
        and s.player_id <> auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- S6 — validation_reviews: authorship and status can't be forged
-- ---------------------------------------------------------------------

-- `is not distinct from` handles the Solo case: Solo players are never
-- signed in, so both sides are NULL and the insert is allowed. An
-- authenticated caller must stamp their own id. Either way the row
-- lands unresolved, unless the caller is an admin using the workbench's
-- one-shot submit-and-resolve path.
drop policy if exists "reviews insert any" on public.validation_reviews;
drop policy if exists "reviews insert own" on public.validation_reviews;
create policy "reviews insert own" on public.validation_reviews for insert
  with check (
    player_id is not distinct from auth.uid()
    and (
      (
        status = 'pending'
        and resolution_type is null
        and reviewed_by is null
        and reviewed_at is null
        and resolution_note is null
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin
      )
    )
  );

-- ---------------------------------------------------------------------
-- S7 — compute_room_scores is still client-callable (0006's revoke missed)
-- ---------------------------------------------------------------------

-- 0006 ran:
--   revoke execute on function public.compute_room_scores(uuid)
--     from anon, authenticated;
-- but a new function's EXECUTE is granted to PUBLIC, not to those roles
-- individually, and anon/authenticated inherit it through PUBLIC. The
-- revoke therefore removed a grant that was never there, and the
-- function stayed callable — caught by tests/rls/rls.test.ts.
--
-- compute_room_scores is SECURITY DEFINER with no caller guard (the host
-- check lives in finalize_round), so any player could rewrite the scores
-- table of any room at any time; clients subscribe to `scores` over
-- realtime, so that surfaces as bogus totals mid-round.
revoke execute on function public.compute_room_scores(uuid) from public, anon, authenticated;
grant  execute on function public.compute_room_scores(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Additive: room lookup by code, for the follow-up that tightens
-- `rooms` SELECT. Nothing calls this yet.
-- ---------------------------------------------------------------------

create or replace function public.find_room_by_code(p_code text)
returns table (
  id uuid,
  code text,
  host_id uuid,
  phase text,
  timer_seconds int,
  sentence text,
  letters_26 text,
  play_started_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.code, r.host_id, r.phase, r.timer_seconds,
         r.sentence, r.letters_26, r.play_started_at, r.created_at
  from public.rooms r
  where r.code = upper(p_code)
  limit 1;
$$;
