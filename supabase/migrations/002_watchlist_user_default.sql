-- Allow an authenticated client insert to omit user_id while still assigning ownership
-- from the verified JWT. The existing RLS WITH CHECK(user_id = auth.uid()) remains required.
alter table public.watchlist alter column user_id set default auth.uid();

grant select, insert, delete on public.watchlist to authenticated;
drop policy if exists "watchlist own access" on public.watchlist;
create policy "watchlist own access" on public.watchlist
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
