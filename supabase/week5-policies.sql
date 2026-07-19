-- CalTrack week 5: allow editing and deleting meals from the app
-- Paste into Supabase Dashboard -> SQL Editor -> Run
-- WARNING: like the week-4 policies, these apply to the public anon role,
-- so anyone with the site URL can update/delete rows. Replace with
-- per-user (auth.uid()) checks once auth is added.

create policy "anon can update meals"
  on public.meals for update
  to anon
  using (true)
  with check (true);

create policy "anon can delete meals"
  on public.meals for delete
  to anon
  using (true);
