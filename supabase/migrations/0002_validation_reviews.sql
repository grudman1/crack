-- 0002: player-feedback triage queue.
--
-- Adds an is_admin flag to profiles, the validation_reviews table that
-- backs the /admin queue, RLS so a row is visible to its submitter and
-- to admins only, and realtime so /admin streams new submissions live.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create table if not exists public.validation_reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  expected_pair text not null check (length(expected_pair) = 2),
  actual_result text not null check (actual_result in ('valid','invalid')),
  reason text,
  trace jsonb not null default '[]'::jsonb,
  player_id uuid references public.profiles(id) on delete set null,
  user_comment text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','duplicate')),
  resolution_type text
    check (resolution_type in ('fix_validator','add_to_dataset')
           or resolution_type is null),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  client_fingerprint text,
  created_at timestamptz not null default now()
);

create index if not exists validation_reviews_status_idx
  on public.validation_reviews(status, created_at desc);

alter table public.validation_reviews enable row level security;

-- Anyone (including anonymous) can file a review. The body is sanitized
-- on the client, and the table is admin-read-only, so the worst case is
-- spam — which we tag with client_fingerprint for later cleanup.
drop policy if exists "reviews insert any" on public.validation_reviews;
create policy "reviews insert any" on public.validation_reviews
  for insert with check (true);

-- A submitter can see their own row (to track status); admins see all.
drop policy if exists "reviews read self or admin" on public.validation_reviews;
create policy "reviews read self or admin" on public.validation_reviews
  for select using (
    (auth.uid() is not null and auth.uid() = player_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Only admins can resolve.
drop policy if exists "reviews update admin" on public.validation_reviews;
create policy "reviews update admin" on public.validation_reviews
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Enable realtime so /admin sees new submissions without a refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'validation_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.validation_reviews;
  END IF;
END $$;
