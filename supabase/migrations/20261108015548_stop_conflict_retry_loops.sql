-- PostgREST retries SQLSTATE 40001. Return the same client error code with HTTP 409
-- while keeping application conflicts separate from PostgreSQL serialization failures.

create or replace function private.flowtime_timer(u uuid, input jsonb) returns jsonb
language plpgsql set search_path = '' as $$
#variable_conflict use_variable
declare s jsonb; rev uuid; action text := input->>'action';
  at_time timestamptz := clock_timestamp(); settings public.user_settings;
  target jsonb; elapsed integer; total integer; sid uuid; duration integer; legacy_saved public.sessions; adopted_saved boolean:=false;
begin
  perform private.flowtime_keys(input,array['action','task_id','expected_revision','next_revision','occurred_at']);
  select state,revision into s,rev from public.active_timers where user_id=u for update;
  if rev is distinct from (input->>'expected_revision')::uuid then
    raise sqlstate 'PGRST' using
      message='{"code":"40001","message":"Timer changed on another device. Refresh before retrying."}',
      detail='{"status":409,"headers":{}}';
  end if;
  if input ? 'occurred_at' then
    if auth.jwt()->>'client_id' is not null then raise exception using errcode='22023',message='Assistants use server time.'; end if;
    at_time := (input->>'occurred_at')::timestamptz;
    if at_time>clock_timestamp()+interval '5 seconds' or at_time<coalesce((s->>'updatedAt')::timestamptz,'epoch') then
      raise sqlstate 'PGRST' using
        message='{"code":"40001","message":"Offline clock or action order conflicts. Review the local work."}',
        detail='{"status":409,"headers":{}}';
    end if;
    at_time:=least(at_time,clock_timestamp());
  end if;
  select * into settings from public.user_settings where user_id=u;
  s:=coalesce(s,jsonb_build_object('phase','idle','selectedTaskId',null,'workSeconds',0,'breakTotal',0,'breakEndAt',null,'startedAt',null,'runawayDetected',false));
  if s->>'protocolVersion' is distinct from '2' then
    s:=s||jsonb_build_object('protocolVersion',2,'runId',coalesce(s->>'sessionId',gen_random_uuid()::text),
      'sessionId',coalesce(s->>'sessionId',gen_random_uuid()::text),'runStartedAt',s->'startedAt',
      'segmentStartedAt',s->'startedAt','completedWorkSeconds',0,'runBreakDivisor',coalesce(settings.break_divisor,5));
  end if;
  if s->>'phase'='working' then
    select * into legacy_saved from public.sessions x where x.user_id=u and x.id=(s->>'sessionId')::uuid and x.entry_source='legacy' and x.started_at=(s->>'startedAt')::timestamptz;
    if found then
      adopted_saved:=true;
      s:=s||jsonb_build_object('phase',case when at_time<legacy_saved.ended_at+legacy_saved.break_seconds*interval '1 second' then 'breaking' else 'done' end,
        'workSeconds',legacy_saved.work_seconds,'completedWorkSeconds',legacy_saved.work_seconds,'breakTotal',legacy_saved.break_seconds,
        'breakEndAt',case when at_time<legacy_saved.ended_at+legacy_saved.break_seconds*interval '1 second' then to_jsonb(legacy_saved.ended_at+legacy_saved.break_seconds*interval '1 second') else 'null'::jsonb end);
    end if;
  end if;
  if s->>'phase'='working' and at_time >= (s->>'runStartedAt')::timestamptz+interval '6 hours' then
    elapsed:=private.flowtime_save_segment(u,s,(s->>'runStartedAt')::timestamptz+interval '6 hours');
    s:=s||jsonb_build_object('phase','done','workSeconds',21600,'completedWorkSeconds',21600,
      'breakEndAt',null,'breakTotal',21600/(s->>'runBreakDivisor')::integer,'runawayDetected',true);
  end if;
  if s->>'phase'='breaking' and at_time >= (s->>'breakEndAt')::timestamptz then
    s:=s||jsonb_build_object('phase','done','breakEndAt',null);
  end if;
  if action in ('select_task','start_work') then
    if s->>'phase'='working' and coalesce(settings.focus_mode_lock,true) then
      raise exception using errcode='22023',message='Focus lock prevents switching tasks while working.';
    end if;
    if input->>'task_id' is not null then target:=private.flowtime_task(u,(input->>'task_id')::uuid); end if;
    if action='start_work' then
      if s->>'phase' not in ('idle','done') or coalesce((s->>'runawayDetected')::boolean,false) then
        raise exception using errcode='22023',message='Finish or skip the break and acknowledge runaway work before starting.';
      end if;
      target:=coalesce(target,private.flowtime_task(u,(s->>'selectedTaskId')::uuid));
      sid:=coalesce((input->>'next_revision')::uuid,gen_random_uuid());
      s:=s||target||jsonb_build_object('phase','working','sessionId',sid,'runId',sid,'runStartedAt',at_time,
        'startedAt',at_time,'segmentStartedAt',at_time,'completedWorkSeconds',0,'workSeconds',0,
        'runBreakDivisor',coalesce(settings.break_divisor,5),'breakEndAt',null,'breakTotal',0,'runawayDetected',false);
    else
      if s->>'phase'='working' and target is null then raise exception using errcode='22023',message='Choose a task while working.'; end if;
      if s->>'phase'='working' and s->>'selectedTaskId' is distinct from target->>'selectedTaskId' then
        elapsed:=private.flowtime_save_segment(u,s,at_time);
        s:=s||jsonb_build_object('sessionId',coalesce((input->>'next_revision')::uuid,gen_random_uuid()),'segmentStartedAt',at_time,
          'completedWorkSeconds',(s->>'completedWorkSeconds')::integer+elapsed);
      end if;
      s:=s||coalesce(target,jsonb_build_object('selectedTaskId',null,'selectedTaskName',null,'selectedTaskColor',null,
        'selectedCategoryId',null,'selectedCategoryName',null,'selectedCategoryColor',null));
    end if;
  elsif action='stop_work' then
    if s->>'phase'='working' then
      elapsed:=private.flowtime_save_segment(u,s,at_time);
      total:=(s->>'completedWorkSeconds')::integer+elapsed;
      duration:=total/(s->>'runBreakDivisor')::integer;
      s:=s||jsonb_build_object('phase',case when duration>0 then 'breaking' else 'done' end,
        'workSeconds',total,'completedWorkSeconds',total,'breakTotal',duration,
        'breakEndAt',case when duration>0 then to_jsonb(at_time+duration*interval '1 second') else 'null'::jsonb end);
    elsif not adopted_saved and not coalesce((s->>'runawayDetected')::boolean,false) then
      raise exception using errcode='22023',message='The timer is not working.';
    end if;
  elsif action='skip_break' then
    if s->>'phase'='working' then raise exception using errcode='22023',message='Stop work before skipping a break.'; end if;
    s:=s||jsonb_build_object('phase','idle','breakEndAt',null,'breakTotal',0,'workSeconds',0,'startedAt',null);
  elsif action='finish_break' then
    if s->>'phase'='breaking' then raise exception using errcode='22023',message='The break has not ended; use skip_break.'; end if;
  elsif action='acknowledge_runaway' then
    s:=s||jsonb_build_object('runawayDetected',false);
  else raise exception using errcode='22023',message='Unknown timer action.';
  end if;
  rev:=coalesce((input->>'next_revision')::uuid,gen_random_uuid());
  s:=s||jsonb_build_object('updatedAt',at_time,'ownerUserId',u,'protocolVersion',2);
  insert into public.active_timers(user_id,state,revision) values(u,s,rev)
    on conflict(user_id) do update set state=excluded.state,revision=excluded.revision;
  return jsonb_build_object('state',s,'revision',rev,'server_time',clock_timestamp());
end $$;

create or replace function private.flowtime_settings(u uuid, input jsonb) returns jsonb
language plpgsql set search_path = '' as $$
#variable_conflict use_variable
declare s public.user_settings; rev uuid; zone text;
begin
  perform private.flowtime_keys(input,array['expected_revision','timezone','break_divisor','chime_enabled','chime_id','focus_mode_lock','shortcuts_enabled','reset']);
  select * into s from public.user_settings where user_id=u for update;
  if s.revision is distinct from (input->>'expected_revision')::uuid then
    raise sqlstate 'PGRST' using
      message='{"code":"40001","message":"Settings changed. Refresh before retrying."}',
      detail='{"status":409,"headers":{}}';
  end if;
  zone:=coalesce(input->>'timezone',s.timezone,'UTC');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception using errcode='22023',message='Use a valid IANA timezone.'; end if;
  rev:=gen_random_uuid();
  if coalesce((input->>'reset')::boolean,false) then
    input:=jsonb_build_object('timezone',zone,'break_divisor',5,'chime_enabled',true,'chime_id','classic-rise','focus_mode_lock',true,'shortcuts_enabled',true);
  end if;
  insert into public.user_settings(user_id,timezone,break_divisor,chime_enabled,chime_id,focus_mode_lock,shortcuts_enabled,revision)
  values(u,zone,coalesce((input->>'break_divisor')::integer,s.break_divisor,5),
    coalesce((input->>'chime_enabled')::boolean,s.chime_enabled,true),coalesce(input->>'chime_id',s.chime_id,'classic-rise'),
    coalesce((input->>'focus_mode_lock')::boolean,s.focus_mode_lock,true),coalesce((input->>'shortcuts_enabled')::boolean,s.shortcuts_enabled,true),rev)
  on conflict(user_id) do update set timezone=excluded.timezone,break_divisor=excluded.break_divisor,
    chime_enabled=excluded.chime_enabled,chime_id=excluded.chime_id,focus_mode_lock=excluded.focus_mode_lock,
    shortcuts_enabled=excluded.shortcuts_enabled,revision=excluded.revision returning * into s;
  return to_jsonb(s)-'user_id';
end $$;

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
      raise sqlstate 'PGRST' using
        message='{"code":"40001","message":"Data or filters changed. Restart pagination."}',
        detail='{"status":409,"headers":{}}';
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
