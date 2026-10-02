create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null check (length(timezone) between 1 and 100),
  break_divisor integer not null default 5 check (break_divisor >= 1),
  chime_enabled boolean not null default true,
  chime_id text not null default 'classic-rise'
    check (chime_id in ('classic-rise', 'gentle-bell', 'bright-glock', 'zen-gong')),
  focus_mode_lock boolean not null default true,
  shortcuts_enabled boolean not null default true,
  revision uuid not null
);

alter table public.user_settings enable row level security;
create policy "Users can read their settings" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their settings" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their settings" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.user_settings from anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;
