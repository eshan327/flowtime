-- Allow command-owned permanent deletes while retaining legacy recoverable deletion.
create or replace function private.flowtime_legacy_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('flowtime.command',true)='on' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then
    if tg_table_name='tasks' then
      update public.tasks set deleted_at=coalesce(deleted_at,now()) where id=old.id;
    else
      update public.categories set deleted_at=coalesce(deleted_at,now()) where id=old.id;
    end if;
    return null;
  end if;
  if tg_table_name='active_timers' and to_jsonb(old)->'state'->>'protocolVersion'='2' then
    raise exception using errcode='55000',message='Update required: reload Flowtime before controlling this timer.';
  end if;
  if tg_table_name='sessions' and (to_jsonb(new)->>'run_id' is not null or exists(
    select 1 from public.active_timers t where t.user_id=(to_jsonb(new)->>'user_id')::uuid and t.state->>'protocolVersion'='2'
      and t.state->>'sessionId'=to_jsonb(new)->>'id')) then
    raise exception using errcode='55000',message='Update required: use timer commands to save this session.';
  end if;
  return new;
end $$;
create or replace function private.flowtime_command(operation text, input jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare u uuid:=private.flowtime_actor(operation<>'legacy_tasks'); receipt private.flowtime_commands; result jsonb;
begin
  if request_id is null or octet_length(input::text)>16384 then raise exception using errcode='22023',message='A request ID and a payload under 16 KiB are required.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
  select * into receipt from private.flowtime_commands c where c.user_id=u and c.request_id=flowtime_command.request_id;
  if found then
    if receipt.operation<>operation or receipt.input<>input then raise exception using errcode='23505',message='Request ID was already used with different arguments.'; end if;
    return receipt.result;
  end if;
  perform set_config('flowtime.command','on',true);
  if operation='timer' then result:=private.flowtime_timer(u,input);
  elsif operation='empty_trash' then
    perform private.flowtime_keys(input,array['confirmed']);
    if auth.jwt()->>'client_id' is not null then
      raise exception using errcode='42501',message='Empty Trash is available only in the Flowtime app.';
    end if;
    if input->'confirmed' is distinct from 'true'::jsonb then
      raise exception using errcode='22023',message='Confirm permanent deletion before emptying Trash.';
    end if;
    delete from public.sessions where user_id=u and deleted_at is not null;
    delete from public.tasks t where t.user_id=u and (t.deleted_at is not null or exists(
      select 1 from public.categories c where c.id=t.category_id and c.user_id=u and c.deleted_at is not null));
    delete from public.categories where user_id=u and deleted_at is not null;
    result:=jsonb_build_object('emptied',true);
  elsif operation='settings' then result:=private.flowtime_settings(u,input);
  elsif operation in ('tasks','categories','sessions','legacy_tasks') then
    perform private.flowtime_keys(input,array['operations','confirmed']);
    if (select count(*) from jsonb_array_elements(input->'operations') v where v->>'action'='trash')>1
      and not coalesce((input->>'confirmed')::boolean,false) then
      raise exception using errcode='22023',message='Confirm the exact records before a bulk trash operation.';
    end if;
    if operation='legacy_tasks' then
      if exists(select 1 from jsonb_array_elements(input->'operations') o where o->>'action' not in ('create','update')) then
        raise exception using errcode='42501',message='Expanded control is required.';
      end if;
      perform private.flowtime_keys(o,array['action','id','name','category_id','completed']) from jsonb_array_elements(input->'operations') o;
    end if;
    result:=private.flowtime_manage(u,case when operation='legacy_tasks' then 'tasks' else operation end,input->'operations');
  else raise exception using errcode='22023',message='Unknown command.'; end if;
  insert into private.flowtime_commands(user_id,request_id,operation,input,result) values(u,request_id,operation,input,result);
  return result;
end $$;

