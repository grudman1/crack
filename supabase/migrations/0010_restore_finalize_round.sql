-- CRACK 0010: restore migration 0006's contents, which production never got.
--
-- Found by scripts/prodSmoke.ts on 2026-09-14: the deployed database has
-- no public.finalize_round. Probing every RPC by name confirmed it —
-- start_round, advance_phase_if_expired, reset_room_for_new_round,
-- is_room_member, shares_room_with and find_room_by_code all exist;
-- finalize_round alone is absent.
--
-- Cause: 0006_finalize_round_and_scoring_fixes.sql and
-- 0006_revert_rooms_read_to_public.sql shared the `0006` prefix, and a
-- migration's version is derived from that prefix. Production recorded
-- version 0006 once and skipped the other file. The revert is the one
-- that landed — `rooms` is publicly readable in production, which is
-- only true if the revert ran — so the finalize/scoring migration was
-- dropped on the floor, silently, and has been missing ever since.
--
-- Impact, in order of severity:
--
--   1. Multiplayer cannot finish a round. Room.tsx's "Compute scores"
--      calls finalizeRound() -> rpc('finalize_round'), which returns
--      PGRST202. Every multiplayer game in production has ended at the
--      voting screen with an error toast. This is the whole reason the
--      RPC exists, and nothing ever exercised it against production.
--
--   2. compute_room_scores is the 0001 version, which counts a player's
--      votes for their own submissions. RLS has blocked new self-votes
--      since 0005, but any row predating that still inflates a score.
--
--   3. votes / submissions / scores lack REPLICA IDENTITY FULL, so
--      filtered DELETE events never reach subscribers. After
--      reset_room_for_new_round clears a round, clients keep showing the
--      previous round's rows until they remount.
--
-- Renaming the revert to 0009 (previous commit) stops the collision
-- recurring, but it cannot fix this: production already has `0006` in
-- schema_migrations, so 0006_finalize will never be picked up. Hence a
-- new version re-applying its contents. Every statement is idempotent —
-- create or replace, revoke, alter replica identity — so this is safe
-- whether or not any of it is already present.

-- H-B: full re-create of compute_room_scores with the self-vote filter
-- added to the tally. Body is otherwise identical to 0001's.
create or replace function public.compute_room_scores(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission record;
  v_valid_count int;
  v_total_voters int;
  v_is_valid boolean;
  v_dup_count int;
  v_points int;
  v_player record;
  v_total int;
  v_breakdown jsonb;
begin
  delete from public.scores where room_id = p_room_id;

  for v_player in
    select distinct player_id from public.submissions where room_id = p_room_id
  loop
    v_total := 0;
    v_breakdown := '{}'::jsonb;
    for v_submission in
      select s.id, s.row_index, s.name
      from public.submissions s
      where s.room_id = p_room_id and s.player_id = v_player.player_id
    loop
      -- H-B: belt-and-suspenders. M1 RLS blocks new self-votes, but
      -- any pre-M1 rows would still be counted without this filter.
      select count(*) filter (where v.is_valid),
             count(*)
        into v_valid_count, v_total_voters
        from public.votes v
        where v.submission_id = v_submission.id
          and v.voter_id <> v_player.player_id;
      v_is_valid := v_total_voters > 0 and v_valid_count * 2 > v_total_voters;
      if v_is_valid then
        select count(*)
          into v_dup_count
          from public.submissions s2
          where s2.room_id = p_room_id
            and s2.row_index = v_submission.row_index
            and s2.id != v_submission.id
            and lower(trim(s2.name)) = lower(trim(v_submission.name));
        v_points := case when v_dup_count > 0 then 5 else 10 end;
      else
        v_points := 0;
      end if;
      v_total := v_total + v_points;
      v_breakdown := v_breakdown || jsonb_build_object(v_submission.row_index::text, v_points);
    end loop;
    insert into public.scores (room_id, player_id, total, breakdown)
    values (p_room_id, v_player.player_id, v_total, v_breakdown);
  end loop;
end;
$$;

-- H-A + M-A + L-C: single host-guarded, atomic finalize. compute + phase
-- flip happen in one transaction; a vote can't slip in between them.
create or replace function public.finalize_round(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.rooms
     where id = p_room_id and host_id = auth.uid() and phase = 'validating'
  ) then
    raise exception 'only the host can finalize, and only during validating';
  end if;

  perform public.compute_room_scores(p_room_id);

  update public.rooms set phase = 'results' where id = p_room_id;
end;
$$;

-- H-A: compute_room_scores is now internal-only — clients must go through
-- finalize_round. finalize_round runs as definer (postgres) so its internal
-- PERFORM still works after the revoke. New functions grant EXECUTE to
-- PUBLIC by default, so finalize_round stays callable by anon/authenticated.
revoke execute on function public.compute_room_scores(uuid) from anon, authenticated;

-- L-D: filtered DELETE realtime events require full row identity, otherwise
-- reset_room_for_new_round's deletes never reach clients (the M4 incremental-
-- apply change removed the full-reload safety net that previously hid this).
alter table public.votes       replica identity full;
alter table public.submissions replica identity full;
alter table public.scores      replica identity full;

-- 0008 revoked EXECUTE from PUBLIC as well, which is what actually stops
-- clients calling compute_room_scores (0006's revoke targeted anon and
-- authenticated, but the grant is to PUBLIC and those roles inherit it
-- from there). CREATE OR REPLACE above preserves existing grants, so the
-- 0008 revoke survives; re-asserting it makes that independent of
-- apply order rather than a thing you have to reason about.
revoke execute on function public.compute_room_scores(uuid) from public, anon, authenticated;
grant  execute on function public.compute_room_scores(uuid) to service_role;
