-- CRACK: initial schema, RLS, and scoring RPC.
-- Run in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Player'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  phase text not null check (phase in ('lobby','playing','validating','results')) default 'lobby',
  timer_seconds int not null default 180,
  sentence text,
  letters_26 text,
  created_at timestamptz not null default now()
);
create index if not exists rooms_code_idx on public.rooms(code);

-- room_players
create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (room_id, player_id)
);
create index if not exists room_players_room_idx on public.room_players(room_id);
create index if not exists room_players_player_idx on public.room_players(player_id);

-- submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  row_index int not null check (row_index between 0 and 25),
  initials text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, row_index)
);
create index if not exists submissions_room_idx on public.submissions(room_id);

-- votes
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  is_valid boolean not null,
  created_at timestamptz not null default now(),
  unique (submission_id, voter_id)
);
create index if not exists votes_room_idx on public.votes(room_id);
create index if not exists votes_submission_idx on public.votes(submission_id);

-- scores
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  total int not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scores_room_idx on public.scores(room_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.submissions enable row level security;
alter table public.votes enable row level security;
alter table public.scores enable row level security;

-- profiles policies
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- rooms policies
drop policy if exists "rooms read all" on public.rooms;
create policy "rooms read all" on public.rooms for select using (true);
drop policy if exists "rooms insert by host" on public.rooms;
create policy "rooms insert by host" on public.rooms for insert with check (auth.uid() = host_id);
drop policy if exists "rooms update by host" on public.rooms;
create policy "rooms update by host" on public.rooms for update using (auth.uid() = host_id);

-- room_players policies
drop policy if exists "rp read members" on public.room_players;
create policy "rp read members" on public.room_players for select
  using (
    auth.uid() = player_id
    or exists (
      select 1 from public.room_players rp2 where rp2.room_id = room_players.room_id and rp2.player_id = auth.uid()
    )
  );
drop policy if exists "rp insert self" on public.room_players;
create policy "rp insert self" on public.room_players for insert with check (auth.uid() = player_id);
drop policy if exists "rp delete self" on public.room_players;
create policy "rp delete self" on public.room_players for delete using (auth.uid() = player_id);

-- submissions policies
drop policy if exists "sub read scoped" on public.submissions;
create policy "sub read scoped" on public.submissions for select using (
  auth.uid() = player_id
  or exists (
    select 1 from public.rooms r
    where r.id = submissions.room_id and r.phase in ('validating','results')
  )
);
drop policy if exists "sub insert self" on public.submissions;
create policy "sub insert self" on public.submissions for insert with check (auth.uid() = player_id);
drop policy if exists "sub update self" on public.submissions;
create policy "sub update self" on public.submissions for update using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- votes policies
drop policy if exists "votes read in room" on public.votes;
create policy "votes read in room" on public.votes for select using (
  exists (
    select 1 from public.room_players rp where rp.room_id = votes.room_id and rp.player_id = auth.uid()
  )
);
drop policy if exists "votes insert self" on public.votes;
create policy "votes insert self" on public.votes for insert with check (
  auth.uid() = voter_id
  and exists (select 1 from public.rooms r where r.id = votes.room_id and r.phase = 'validating')
);
drop policy if exists "votes update self" on public.votes;
create policy "votes update self" on public.votes for update using (auth.uid() = voter_id) with check (auth.uid() = voter_id);

-- scores policies
drop policy if exists "scores read in room" on public.scores;
create policy "scores read in room" on public.scores for select using (
  exists (
    select 1 from public.room_players rp where rp.room_id = scores.room_id and rp.player_id = auth.uid()
  )
);

-- Scoring RPC
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
      select count(*) filter (where is_valid = true),
             count(*)
        into v_valid_count, v_total_voters
        from public.votes
        where submission_id = v_submission.id;
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

-- Enable realtime
DO $$
DECLARE
  _tables text[] := ARRAY[
    'public.rooms',
    'public.room_players',
    'public.submissions',
    'public.votes',
    'public.scores'
  ];
  _t text;
  _schema text;
  _rel text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    _schema := split_part(_t, '.', 1);
    _rel := split_part(_t, '.', 2);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE p.pubname = 'supabase_realtime'
        AND n.nspname = _schema
        AND c.relname = _rel
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I;', _schema, _rel);
    END IF;
  END LOOP;
END $$;
