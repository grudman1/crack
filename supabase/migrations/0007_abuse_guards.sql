-- CRACK 0007: cheap server-side abuse guards.
--
-- M1: cap display_name length at the DB level. The client caps at 24
-- (Multiplayer.tsx, Room.tsx); a direct PostgREST UPDATE on profiles
-- bypasses that. No XSS risk (display names render as JSX text), but
-- unbounded names cause UI overflow and DB bloat. Truncate any
-- existing rows first so the new CHECK constraint can be added
-- without failing.
--
-- B3 (per-account half): throttle room creation to 10/hour per host.
-- This limits what a SINGLE account can do — it does NOT stop an
-- attacker minting fresh anonymous users and creating one room each.
-- The complementary choke point is the Supabase Dashboard →
-- Authentication → Rate Limits anon sign-in cap, which the project
-- owner sets out of band.
--
-- Room TTL (pg_cron-based cleanup) is intentionally NOT in this
-- migration — it needs the pg_cron extension enabled at the project
-- level and pairs with the dashboard rate-limit decision.

-- M1: truncate any pre-existing long names, then add the constraint.
update public.profiles
   set display_name = substring(display_name from 1 for 32)
 where char_length(display_name) > 32;

alter table public.profiles
  drop constraint if exists display_name_length;
alter table public.profiles
  add constraint display_name_length check (char_length(display_name) <= 32);

-- B3 (per-account half): BEFORE INSERT trigger on rooms.
create or replace function public.enforce_room_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  select count(*) into recent
    from public.rooms
   where host_id = auth.uid()
     and created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'room creation rate limit reached (10 per hour)';
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_rate_limit on public.rooms;
create trigger rooms_rate_limit
  before insert on public.rooms
  for each row execute function public.enforce_room_rate_limit();
