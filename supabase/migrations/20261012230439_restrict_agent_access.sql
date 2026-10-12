-- OAuth grants must not inherit the browser's unrestricted own-row policies.
-- Restrictive policies AND with existing ownership policies, including FOR ALL.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['tasks', 'categories', 'sessions', 'active_timers', 'user_settings', 'subtasks'] loop
    execute format('create policy "agent_token_boundary" on public.%I as restrictive for all to authenticated
      using ((select auth.jwt()->>''client_id'') is null or (
        (select auth.jwt()->''aud'') ? ''https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent''
        and (select auth.jwt()->>''is_anonymous'') = ''false''))
      with check ((select auth.jwt()->>''client_id'') is null or (
        (select auth.jwt()->''aud'') ? ''https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent''
        and (select auth.jwt()->>''is_anonymous'') = ''false''))', table_name);
    execute format('create policy "agent_no_delete" on public.%I as restrictive for delete to authenticated
      using ((select auth.jwt()->>''client_id'') is null)', table_name);
    if table_name <> 'tasks' then
      execute format('create policy "agent_no_insert" on public.%I as restrictive for insert to authenticated
        with check ((select auth.jwt()->>''client_id'') is null)', table_name);
      execute format('create policy "agent_no_update" on public.%I as restrictive for update to authenticated
        using ((select auth.jwt()->>''client_id'') is null)
        with check ((select auth.jwt()->>''client_id'') is null)', table_name);
    end if;
  end loop;
end $$;

create policy "agent_no_subtasks" on public.subtasks as restrictive for select to authenticated
  using ((select auth.jwt()->>'client_id') is null);
create policy "agent_no_deleted_sessions" on public.sessions as restrictive for select to authenticated
  using ((select auth.jwt()->>'client_id') is null or deleted_at is null);
create policy "agent_no_storage" on storage.objects as restrictive for all to authenticated
  using ((select auth.jwt()->>'client_id') is null)
  with check ((select auth.jwt()->>'client_id') is null);

-- A foreign key alone does not check that the category belongs to the task owner.
create policy "agent_task_category_owner" on public.tasks as restrictive for all to authenticated
  using (true)
  with check ((select auth.jwt()->>'client_id') is null or category_id is null or exists (
    select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())
  ));

-- Install as the Custom Access Token hook before enabling the OAuth server.
-- It runs as supabase_auth_admin, not as a privileged definer or an API RPC.
create schema if not exists private;
create function private.flowtime_agent_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare claims jsonb := event->'claims';
begin
  if coalesce(event->>'client_id', claims->>'client_id') is not null then
    claims := jsonb_set(claims, '{aud}', '["authenticated", "https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent"]'::jsonb);
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;
revoke all on function private.flowtime_agent_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.flowtime_agent_token_hook(jsonb) to supabase_auth_admin;
