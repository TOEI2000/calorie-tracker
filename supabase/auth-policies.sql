-- CalTrack bonus week: per-user data isolation
-- Run AFTER the auth version of the frontend is deployed.
-- Replaces the open anon policies with per-user (auth.uid()) policies.

drop policy "anon can read meals" on public.meals;
drop policy "anon can insert meals" on public.meals;
drop policy "anon can update meals" on public.meals;
drop policy "anon can delete meals" on public.meals;

alter table public.meals alter column user_id set default auth.uid();

create policy "users read own meals"
  on public.meals for select
  to authenticated
  using (user_id = auth.uid());

create policy "users insert own meals"
  on public.meals for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users update own meals"
  on public.meals for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own meals"
  on public.meals for delete
  to authenticated
  using (user_id = auth.uid());
