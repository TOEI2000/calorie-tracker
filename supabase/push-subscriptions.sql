-- CalTrack: push notification subscriptions
-- Paste into Supabase Dashboard -> SQL Editor -> Run (once)

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users read own subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "users insert own subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users update own subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- n8n reads all rows with the service_role key (bypasses RLS) to send pushes.
