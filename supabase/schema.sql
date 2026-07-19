-- CalTrack: meals table (week 4)
-- Paste this into Supabase Dashboard -> SQL Editor -> Run

create table if not exists public.meals (
  id bigint generated always as identity primary key,
  user_id uuid, -- nullable for now; will link to auth.users when login is added
  eaten_at timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  total_calories integer,
  note text
);

create index if not exists meals_eaten_at_idx on public.meals (eaten_at);

alter table public.meals enable row level security;

-- No login yet, so the public anon role may read and insert.
-- WARNING: anyone with the site URL can read/insert rows.
-- Replace these policies with per-user (auth.uid()) checks once auth is added.
create policy "anon can read meals"
  on public.meals for select
  to anon
  using (true);

create policy "anon can insert meals"
  on public.meals for insert
  to anon
  with check (true);
