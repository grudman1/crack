-- CRACK 0006: atomize + lock down MP scoring, self-defending tally, realtime DELETEs.
--
-- Three things here, all in service of the MP voting/scoring audit pack:
--
--   H-A + M-A + L-C:
--     compute_room_scores had no caller guard — any authenticated user
--     could call it for any room. handleCompute was also two separate
--     awaits (compute, then setRoomPhase('results')), so a vote could
--     land between them and never be tallied. We collapse the two into
--     a single host-guarded, atomic finalize_round RPC. Clients lose
--     execute on compute_room_scores; finalize_round runs as definer
--     so its internal PERFORM still works.
--
--   H-B:
--     The tally counted every vote on a submission with no defense
--     against self-votes. M1 (in 0005) added RLS to block new ones,
--     but any pre-M1 self-vote rows in production would still be
--     counted. Add `voter_id <> player_id` to the tally subquery.
--
--   L-D:
--     The M4 incremental-apply change to useRealtimeTable removed the
--     full-reload safety net. Filtered DELETE realtime events require
--     REPLICA IDENTITY FULL on the source tables — otherwise
--     reset_room_for_new_round's deletes never reach clients and
--     stale prior-round rows linger in memory.

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
