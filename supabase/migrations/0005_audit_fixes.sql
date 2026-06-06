-- CRACK 0005: bug-sweep fixes (see internal audit report).
--
-- This migration batches the SQL-side findings from the codebase audit:
--   * C1  cross-room submission leak via sub_read_scoped
--   * H3  host-stranded phase transition (server-side advance + start stamp)
--   * H7  votes UPDATE missing phase check (post-results vote flipping)
--   * M1  voting on your own submission was RLS-allowed (UI-only guard)
--   * M2  no rate limit on validation_reviews INSERT (spam)
--   * M3  rooms read policy was `true` (full enumeration) — tightened to
--         authenticated only; per-room gating would need a code-lookup
--         RPC + bigger refactor, left as a follow-up
--   * M5  rooms had no DELETE policy (rooms immortal) — host-DELETE added;
--         automated TTL is a separate decision
--   * M8  client-side timer drift — `play_started_at` is now the single
--         source of truth that all clients compute remaining from

-- 1. Schema: stamp when each round started.
alter table public.rooms
  add column if not exists play_started_at timestamptz;

-- 2. C1 — Cross-room submission leak.
-- The original policy let any authenticated user read submissions of
-- any room in validating/results, with no membership check. Combined
-- with `rooms read all using (true)`, that meant enumerate UUIDs →
-- read everyone's answers. Gate on membership using the helper added
-- in 0004.
drop policy if exists "sub read scoped" on public.submissions;
create policy "sub read scoped" on public.submissions for select
  using (
    auth.uid() = player_id
    or (
      public.is_room_member(submissions.room_id)
      and exists (
        select 1 from public.rooms r
        where r.id = submissions.room_id and r.phase in ('validating','results')
      )
    )
  );

-- 3. H7 — votes UPDATE missing phase check.
-- INSERT requires phase='validating', but UPDATE only required
-- voter_id = auth.uid(), so a player could flip their vote during
-- 'results'. If a host re-ran compute_room_scores, totals changed.
drop policy if exists "votes update self" on public.votes;
create policy "votes update self" on public.votes for update
  using (auth.uid() = voter_id)
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.rooms r
      where r.id = votes.room_id and r.phase = 'validating'
    )
  );

-- 4. M1 — voting on your own submission.
-- The UI hid the buttons for your own row, but RLS allowed it via a
-- direct PostgREST upsert. Disallow at the policy level on both
-- INSERT and UPDATE.
drop policy if exists "votes insert self" on public.votes;
create policy "votes insert self" on public.votes for insert
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.rooms r
      where r.id = votes.room_id and r.phase = 'validating'
    )
    and not exists (
      select 1 from public.submissions s
      where s.id = votes.submission_id and s.player_id = auth.uid()
    )
  );

-- Re-create the UPDATE policy on top with the same anti-self-vote check.
drop policy if exists "votes update self" on public.votes;
create policy "votes update self" on public.votes for update
  using (auth.uid() = voter_id)
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.rooms r
      where r.id = votes.room_id and r.phase = 'validating'
    )
    and not exists (
      select 1 from public.submissions s
      where s.id = votes.submission_id and s.player_id = auth.uid()
    )
  );

-- 5. M3 — rooms read.
-- Previously `using (true)`: anonymous (unauthenticated) clients could
-- enumerate every room. Tighten to authenticated callers (Supabase
-- anonymous auth still counts). Full per-room gating would require a
-- code-lookup RPC for the join flow — left as a follow-up. The
-- sensitive payloads (submissions/votes/scores) are already gated by
-- C1's membership check, so this is defense in depth.
drop policy if exists "rooms read all" on public.rooms;
create policy "rooms read authed" on public.rooms for select
  using (auth.role() = 'authenticated');

-- 6. M5 — rooms had no DELETE policy. Add host-only delete so a host
-- can close an abandoned room. Cascade deletes clean room_players,
-- submissions, votes, scores. No automated TTL in this migration —
-- that's a separate decision.
drop policy if exists "rooms delete by host" on public.rooms;
create policy "rooms delete by host" on public.rooms for delete
  using (auth.uid() = host_id);

-- 7. H3/M8 — server-side phase advance + start stamp.
-- The client-side timer wrote phase='validating' only when isHost &&
-- remaining<=0. If the host disconnected mid-round, the game was
-- stuck forever. Also each client computed `remaining` from its own
-- first-render Date.now(), so joiners' timers drifted vs the host's.
--
-- Fix: host calls start_round, which atomically sets phase='playing'
-- and stamps play_started_at. Every client computes remaining from
-- that stamp (no drift). The timer effect calls
-- advance_phase_if_expired on every tick (any member can), which is
-- idempotent and only advances when actually due.
create or replace function public.start_round(
  p_room_id uuid,
  p_sentence text,
  p_letters text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_id = auth.uid()
  ) then
    raise exception 'only the host can start a round';
  end if;
  update public.rooms
     set phase            = 'playing',
         sentence         = p_sentence,
         letters_26       = p_letters,
         play_started_at  = now()
   where id = p_room_id;
end;
$$;

create or replace function public.advance_phase_if_expired(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Any room member can request the advance; the function only acts
  -- when the round has actually run out, so concurrent ticks are safe.
  if not public.is_room_member(p_room_id) then
    raise exception 'must be a room member';
  end if;
  update public.rooms
     set phase = 'validating'
   where id = p_room_id
     and phase = 'playing'
     and play_started_at is not null
     and play_started_at + (timer_seconds || ' seconds')::interval <= now();
end;
$$;

-- 8. M2 — rate-limit validation_reviews INSERTs.
-- INSERT was `with check (true)` so anyone could spam. Throttle by
-- player_id when present and by client_fingerprint otherwise. 10
-- inserts / minute is well above any legitimate use of the flag-this
-- modal and below what makes the queue unusable.
create or replace function public.rate_limit_validation_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
begin
  select count(*) into cnt
    from public.validation_reviews
   where created_at > now() - interval '1 minute'
     and (
       (new.player_id is not null and player_id = new.player_id)
       or (new.player_id is null
           and new.client_fingerprint is not null
           and client_fingerprint = new.client_fingerprint)
     );
  if cnt >= 10 then
    raise exception 'rate limit exceeded — try again in a minute';
  end if;
  return new;
end;
$$;

drop trigger if exists validation_reviews_rate_limit on public.validation_reviews;
create trigger validation_reviews_rate_limit
  before insert on public.validation_reviews
  for each row execute function public.rate_limit_validation_reviews();
