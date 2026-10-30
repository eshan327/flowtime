-- Invalidate cursors when joined attribution/visibility or resolved calendar settings change.
create or replace function private.flowtime_read(operation text, input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare u uuid:=private.flowtime_actor(operation in ('session','settings') or coalesce(input->>'trash','exclude')<>'exclude');
  lim integer:=coalesce((input->>'limit')::integer,50); off integer:=coalesce((input->>'offset')::integer,0);
  rev text; fingerprint text; rows jsonb; total bigint; state jsonb; timer_rev uuid; result jsonb;
  zone text; from_time timestamptz:=(input->>'from')::timestamptz; to_time timestamptz:=(input->>'to')::timestamptz;
begin
  if lim not between 1 and 100 or off<0 or octet_length(input::text)>16384 then raise exception using errcode='22023',message='Invalid page or payload size.'; end if;
  if from_time is not null and to_time is not null and to_time<=from_time then raise exception using errcode='22023',message='Use an increasing date range.'; end if;
  select md5(coalesce(jsonb_object_agg(dataset,revision)::text,'{}')) into rev
    from private.flowtime_revisions where user_id=u and dataset=any(case
      when operation in ('sessions','session','summary') then array['sessions','tasks','categories']
      when operation='tasks' then array['tasks','categories'] else array[operation] end);
  if operation='summary' then
    zone:=coalesce(input->>'timezone',(select timezone from public.user_settings where user_id=u),'UTC');
    input:=input||jsonb_build_object('timezone',zone);
    if input->>'period' is not null and input->>'anchor' is null then
      input:=input||jsonb_build_object('anchor',(now() at time zone zone)::date);
    end if;
  end if;
  fingerprint:=md5((input-'cursor'-'offset'-'limit')::text);
  if input->'cursor' is not null and input->'cursor'<>'null'::jsonb then
    if input->'cursor'->>'revision' is distinct from rev::text or input->'cursor'->>'filter' is distinct from fingerprint then
      raise exception using errcode='40001',message='Data or filters changed. Restart pagination.';
    end if;
    off:=(input->'cursor'->>'offset')::integer;
    if off is null or off<0 then raise exception using errcode='22023',message='Invalid cursor.'; end if;
  end if;
  if operation='timer' then
    select t.state,t.revision into state,timer_rev from public.active_timers t where user_id=u;
    state:=coalesce(state,jsonb_build_object('phase','idle','selectedTaskId',null,'startedAt',null,'breakEndAt',null,'workSeconds',0,'breakTotal',0,'runawayDetected',false));
    if state->>'phase'='working' then state:=state||jsonb_build_object('workSeconds',greatest(0,least(21600,floor(extract(epoch from now()-coalesce((state->>'runStartedAt')::timestamptz,(state->>'startedAt')::timestamptz)))::integer))); end if;
    return jsonb_build_object('state',state,'revision',timer_rev,'server_time',now(),'observed_at',now(),'source','server_state','may_be_stale',true,
      'snapshot',jsonb_build_object('phase',state->'phase','selectedTaskId',state->'selectedTaskId','startedAt',state->'startedAt',
        'breakEndAt',state->'breakEndAt','workSeconds',state->'workSeconds','breakSeconds',state->'breakTotal'),
      'settings',coalesce((select jsonb_build_object('timezone',timezone,'break_divisor',break_divisor) from public.user_settings where user_id=u),jsonb_build_object('timezone','UTC','break_divisor',5)));
  elsif operation='settings' then
    return coalesce((select to_jsonb(s)-'user_id' from public.user_settings s where user_id=u),
      jsonb_build_object('timezone','UTC','break_divisor',5,'chime_enabled',true,'chime_id','classic-rise','focus_mode_lock',true,'shortcuts_enabled',true,'revision',null));
  elsif operation='summary' then
    result:=private.flowtime_summary(u,input||jsonb_build_object('offset',off,'limit',lim));
    return result||jsonb_build_object('revision',rev::text,'next_cursor',case when result->>'next_offset' is not null then jsonb_build_object('offset',result->'next_offset','revision',rev::text,'filter',fingerprint) else null end);
  elsif operation='revisions' then
    return coalesce((select jsonb_object_agg(dataset,revision::text) from private.flowtime_revisions where user_id=u),'{}');
  elsif operation='tasks' then
    with matching as (select t.*,to_jsonb(c) as categories,c.deleted_at as category_deleted_at from public.tasks t
      left join public.categories c on c.id=t.category_id and c.user_id=u where t.user_id=u
      and (not(input ? 'ids') or t.id in (select value::uuid from jsonb_array_elements_text(input->'ids')))
      and (not(input ? 'category_id') or t.category_id is not distinct from (input->>'category_id')::uuid)
      and (coalesce(input->>'status','active')='all' or (input->>'status'='completed' and t.completed_at is not null) or (coalesce(input->>'status','active')='active' and t.completed_at is null))
      and (coalesce(input->>'trash','exclude')='include' or (input->>'trash'='only' and (t.deleted_at is not null or c.deleted_at is not null)) or (coalesce(input->>'trash','exclude')='exclude' and t.deleted_at is null and c.deleted_at is null))
      and (coalesce(input->>'query','')='' or strpos(lower(t.name||' '||coalesce(t.notes,'')),lower(input->>'query'))>0)
      and (not coalesce((input->>'selectable')::boolean,false) or (t.completed_at is null and t.deleted_at is null and (t.category_id is null or (c.id is not null and c.archived_at is null and c.deleted_at is null)))))
    select (select count(*) from matching),coalesce((select jsonb_agg(to_jsonb(x)) from (select * from matching order by position,created_at,id limit lim offset off) x),'[]') into total,rows;
  elsif operation='categories' then
    with matching as (select * from public.categories c where user_id=u
      and (coalesce(input->>'trash','exclude')='include' or (input->>'trash'='only' and deleted_at is not null) or (coalesce(input->>'trash','exclude')='exclude' and deleted_at is null))
      and (coalesce(input->>'query','')='' or strpos(lower(name),lower(input->>'query'))>0)
      and (not(input ? 'archived') or (archived_at is not null)=(input->>'archived')::boolean))
    select (select count(*) from matching),coalesce((select jsonb_agg(to_jsonb(x)) from (select * from matching order by position,created_at,id limit lim offset off) x),'[]') into total,rows;
  elsif operation in ('sessions','session') then
    with matching as (select s.*,to_jsonb(t)||jsonb_build_object('categories',to_jsonb(c)) as tasks from public.sessions s
      left join public.tasks t on t.id=s.task_id and t.user_id=u left join public.categories c on c.id=t.category_id and c.user_id=u
      where s.user_id=u and (operation<>'session' or s.id=(input->>'id')::uuid)
      and (coalesce(input->>'trash','exclude')='include' or (input->>'trash'='only' and s.deleted_at is not null) or (coalesce(input->>'trash','exclude')='exclude' and s.deleted_at is null))
      and (from_time is null or s.ended_at>from_time) and (to_time is null or s.started_at<to_time)
      and (not(input ? 'task_id') or (case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.task_id_snapshot else s.task_id end) is not distinct from (input->>'task_id')::uuid)
      and (not(input ? 'category_id') or (case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.category_id_snapshot else c.id end) is not distinct from (input->>'category_id')::uuid)
      and (coalesce(input->>'query','')='' or strpos(lower(coalesce(s.task_name_snapshot,t.name,'')||' '||coalesce(s.category_name_snapshot,c.name,'')||' '||coalesce(s.notes,'')),lower(input->>'query'))>0))
    select (select count(*) from matching),coalesce((select jsonb_agg(to_jsonb(x)) from (select * from matching order by started_at,id limit lim offset off) x),'[]') into total,rows;
    if operation='session' then
      if total=0 then raise exception using errcode='P0002',message='Session not found.'; end if;
      return rows->0;
    end if;
  else raise exception using errcode='22023',message='Unknown read operation.'; end if;
  return jsonb_build_object('items',rows,'revision',rev::text,'next_offset',case when off+lim<total then off+lim else null end,
    'next_cursor',case when off+lim<total then jsonb_build_object('offset',off+lim,'revision',rev::text,'filter',fingerprint) else null end);
end $$;

