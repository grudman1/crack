-- CRACK 0004: fix the recursive room_players read policy (the lobby
-- "stuck on Waiting…" bug) and move the new-round reset server-side.
--
-- WHY:
--   * The original "rp read members" SELECT policy on room_players had
--     a subquery against room_players itself. A policy on table T that
--     references T re-applies the same policy to the inner reference,
--     which Postgres detects as a cycle and rejects with
--     42P17 "infinite recursion detected in policy for relation
--     room_players". Every SELECT on room_players therefore failed, so
--     the lobby player list was always empty and Start stayed disabled.
--   * resetRoomForNewRound() deleted submissions/votes/scores from the
--     client, but there are no DELETE policies on submissions or votes,
--     so those deletes silently affected 0 rows — stale round data
--     leaked into the next round. We do the reset in a SECURITY DEFINER
--     RPC instead (host-checked) rather than granting clients delete.

-- 1. Membership helper. SECURITY DEFINER => the inner read bypasses RLS,
--    which is what breaks the recursion cycle.
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and player_id = auth.uid()
  );
$$;

-- 2. Rewrite the room_players read policy to use the helper.
drop policy if exists "rp read members" on public.room_players;
create policy "rp read members" on public.room_players for select
  using (
    auth.uid() = player_id
    or public.is_room_member(room_id)
  );

-- 3. (Cleanup) votes/scores read policies inlined an EXISTS over
--    room_players, which re-triggered room_players RLS on every read.
--    Reuse the helper so they no longer depend on room_players' policy.
drop policy if exists "votes read in room" on public.votes;
create policy "votes read in room" on public.votes for select
  using ( public.is_room_member(votes.room_id) );

drop policy if exists "scores read in room" on public.scores;
create policy "scores read in room" on public.scores for select
  using ( public.is_room_member(scores.room_id) );

-- 4. Server-side, host-only round reset. Mirrors the previous client
--    behavior (returns the room to 'lobby' with the new phrase preloaded)
--    but actually clears the prior round because it runs as definer.
create or replace function public.reset_room_for_new_round(
  p_room_id uuid,
  p_sentence text,
  p_letters text,
  p_timer_seconds int
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
    raise exception 'only the host can reset the room';
  end if;

  delete from public.submissions where room_id = p_room_id;
  delete from public.votes       where room_id = p_room_id;
  delete from public.scores      where room_id = p_room_id;

  update public.rooms
     set phase         = 'lobby',
         sentence      = p_sentence,
         letters_26    = p_letters,
         timer_seconds = p_timer_seconds
   where id = p_room_id;
end;
$$;
