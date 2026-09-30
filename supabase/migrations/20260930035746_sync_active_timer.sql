create table public.active_timers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision uuid not null
);

alter table public.active_timers enable row level security;
create policy "Users can read their timer" on public.active_timers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their timer" on public.active_timers
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their timer" on public.active_timers
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.active_timers to authenticated;
revoke all on public.active_timers from anon;
