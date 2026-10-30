-- Additive rollout: no expanded OAuth access is granted by this migration.
alter table public.tasks add column deleted_at timestamptz,
  add column notes text, add column due_date date, add column priority text,
  add column reference_url text,
  add constraint tasks_notes_length check (length(notes) <= 4000),
  add constraint tasks_priority check (priority in ('low','normal','high')),
  add constraint tasks_reference_url check (length(reference_url) <= 2000 and reference_url ~ '^https?://[^[:space:]]+$');
alter table public.categories add column deleted_at timestamptz;
alter table public.sessions add column entry_source text not null default 'legacy',
  add column run_id uuid,
  add constraint sessions_entry_source check (entry_source in ('legacy','timer','manual'));
create index tasks_user_visible_order_idx on public.tasks(user_id,category_id,position,id) where deleted_at is null;
create index sessions_user_cursor_idx on public.sessions(user_id,started_at,id);

create table private.flowtime_agent_clients (client_id uuid primary key);
create table private.flowtime_agent_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references private.flowtime_agent_clients(client_id),
  version integer not null default 2, approved_at timestamptz, primary key(user_id,client_id)
);
create table private.flowtime_commands (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null, operation text not null, input jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(user_id,request_id)
);
create table private.flowtime_revisions (
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset text not null, revision bigint not null default 0, primary key(user_id,dataset)
);
alter table private.flowtime_agent_clients enable row level security;
alter table private.flowtime_agent_access enable row level security;
alter table private.flowtime_commands enable row level security;
alter table private.flowtime_revisions enable row level security;
revoke all on all tables in schema private from public,anon,authenticated;

create function private.flowtime_actor(expanded boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare u uuid := auth.uid(); j jsonb := auth.jwt(); c text := j->>'client_id';
begin
  if u is null or not exists(select 1 from auth.users where id=u) then
    raise exception using errcode='28000',message='Sign in to Flowtime.';
  end if;
  if c is not null then
    if j->>'role' <> 'authenticated' or j->>'is_anonymous' is distinct from 'false'
      or not coalesce((j->'aud') ? 'https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent',false)
      or not exists(select 1 from private.flowtime_agent_clients where client_id::text=c) then
      raise exception using errcode='42501',message='Untrusted Flowtime agent connection.';
    end if;
    if expanded and not exists(select 1 from private.flowtime_agent_access
      where user_id=u and client_id::text=c and version=2 and approved_at is not null) then
      raise exception using errcode='42501',message='Approve expanded control in Flowtime Agent connections.';
    end if;
  end if;
  return u;
end $$;

create function private.flowtime_keys(value jsonb, allowed text[]) returns void
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(value) is distinct from 'object' or exists(
    select 1 from jsonb_object_keys(value) k where not (k=any(allowed))) then
    raise exception using errcode='22023',message='Unknown or invalid operation fields.';
  end if;
end $$;

create function private.flowtime_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.flowtime_revisions(user_id,dataset,revision)
    values(coalesce(new.user_id,old.user_id),tg_table_name,1)
    on conflict(user_id,dataset) do update set revision=private.flowtime_revisions.revision+1;
  return null;
end $$;
create trigger flowtime_history_revision after insert or update or delete on public.sessions
for each row execute function private.flowtime_changed();
create trigger flowtime_task_revision after insert or update or delete on public.tasks
for each row execute function private.flowtime_changed();
create trigger flowtime_category_revision after insert or update or delete on public.categories
for each row execute function private.flowtime_changed();

create function private.flowtime_legacy_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('flowtime.command',true)='on' then return new; end if;
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
create trigger flowtime_recover_task before delete on public.tasks for each row execute function private.flowtime_legacy_guard();
create trigger flowtime_recover_category before delete on public.categories for each row execute function private.flowtime_legacy_guard();
create trigger flowtime_protect_timer before update on public.active_timers for each row execute function private.flowtime_legacy_guard();
create trigger flowtime_protect_segment before insert or update on public.sessions for each row execute function private.flowtime_legacy_guard();

create function private.flowtime_task(u uuid, task_id uuid, selectable boolean default true) returns jsonb
language plpgsql stable set search_path = '' as $$
#variable_conflict use_variable
declare result jsonb;
begin
  select jsonb_build_object('selectedTaskId',t.id,'selectedTaskName',t.name,
    'selectedTaskColor',coalesce(c.color,t.color,'#61afef'),'selectedCategoryId',c.id,
    'selectedCategoryName',c.name,'selectedCategoryColor',c.color) into result
  from public.tasks t left join public.categories c on c.id=t.category_id and c.user_id=u
  where t.id=task_id and t.user_id=u and (not selectable or
    (t.deleted_at is null and t.completed_at is null and
    (t.category_id is null or (c.id is not null and c.deleted_at is null and c.archived_at is null))));
  if result is null then raise exception using errcode='P0002',message='Available task not found.'; end if;
  return result;
end $$;

create function private.flowtime_save_segment(u uuid, state jsonb, end_time timestamptz) returns integer
language plpgsql set search_path = '' as $$
#variable_conflict use_variable
declare a timestamptz := (state->>'segmentStartedAt')::timestamptz;
  prior integer := coalesce((state->>'completedWorkSeconds')::integer,0);
  elapsed integer := greatest(0,least(21600-prior,floor(extract(epoch from end_time-(state->>'runStartedAt')::timestamptz))::integer-prior));
  divisor integer := (state->>'runBreakDivisor')::integer;
  task_id uuid := (state->>'selectedTaskId')::uuid;
begin
  if elapsed=0 then return 0; end if;
  if not exists(select 1 from public.tasks where id=task_id and user_id=u) then task_id:=null; end if;
  insert into public.sessions(id,user_id,task_id,started_at,ended_at,work_seconds,break_seconds,
    task_id_snapshot,task_name_snapshot,task_color_snapshot,category_id_snapshot,category_name_snapshot,
    category_color_snapshot,entry_source,run_id)
  values((state->>'sessionId')::uuid,u,task_id,a,end_time,elapsed,
    (prior+elapsed)/divisor-prior/divisor,(state->>'selectedTaskId')::uuid,state->>'selectedTaskName',
    state->>'selectedTaskColor',(state->>'selectedCategoryId')::uuid,state->>'selectedCategoryName',
    state->>'selectedCategoryColor','timer',(state->>'runId')::uuid);
  return elapsed;
end $$;

create function private.flowtime_timer(u uuid, input jsonb) returns jsonb
language plpgsql set search_path = '' as $$
#variable_conflict use_variable
declare s jsonb; rev uuid; action text := input->>'action';
  at_time timestamptz := clock_timestamp(); settings public.user_settings;
  target jsonb; elapsed integer; total integer; sid uuid; duration integer; legacy_saved public.sessions; adopted_saved boolean:=false;
begin
  perform private.flowtime_keys(input,array['action','task_id','expected_revision','next_revision','occurred_at']);
  select state,revision into s,rev from public.active_timers where user_id=u for update;
  if rev is distinct from (input->>'expected_revision')::uuid then
    raise exception using errcode='40001',message='Timer changed on another device. Refresh before retrying.';
  end if;
  if input ? 'occurred_at' then
    if auth.jwt()->>'client_id' is not null then raise exception using errcode='22023',message='Assistants use server time.'; end if;
    at_time := (input->>'occurred_at')::timestamptz;
    if at_time>clock_timestamp()+interval '5 seconds' or at_time<coalesce((s->>'updatedAt')::timestamptz,'epoch') then
      raise exception using errcode='40001',message='Offline clock or action order conflicts. Review the local work.';
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

create function private.flowtime_manage(u uuid, kind text, operations jsonb) returns jsonb
language plpgsql set search_path = '' as $$
#variable_conflict use_variable
declare op jsonb; action text; id uuid; cat uuid; t public.tasks; c public.categories;
  s public.sessions; result jsonb := '[]'; pos double precision; snap jsonb;
  start_time timestamptz; end_time timestamptz; work integer; rest integer; row_data jsonb;
begin
  if jsonb_typeof(operations) is distinct from 'array' or jsonb_array_length(operations) not between 1 and 50 then
    raise exception using errcode='22023',message='Supply between 1 and 50 operations.';
  end if;
  for op in select value from jsonb_array_elements(operations) loop
    action:=op->>'action'; id:=(op->>'id')::uuid;
    if id is null then raise exception using errcode='22023',message='Every operation needs an ID.'; end if;
    if kind='tasks' then
      perform private.flowtime_keys(op,array['action','id','name','color','category_id','completed','position','notes','due_date','priority','reference_url']);
      select * into t from public.tasks where tasks.id=id and user_id=u for update;
      if action='create' then
        if exists(select 1 from public.tasks where tasks.id=id) then raise exception using errcode='23505',message='Task ID already exists; inspect it before retrying with different arguments.'; end if;
      elsif t.id is null then raise exception using errcode='P0002',message='Task not found.'; end if;
      if action in ('create','update') then
        if action='create' or op ? 'category_id' then
          cat:=(op->>'category_id')::uuid;
          if cat is not null and not exists(select 1 from public.categories where categories.id=cat and user_id=u and archived_at is null and deleted_at is null) then
            raise exception using errcode='P0002',message='Active category not found.';
          end if;
        else cat:=t.category_id; end if;
        if (action='create' or op ? 'name') and (length(btrim(coalesce(op->>'name',''))) not between 1 and 200) then
          raise exception using errcode='22023',message='Names must contain 1–200 characters.';
        end if;
        if op->>'color' is not null and op->>'color' !~ '^#[0-9A-Fa-f]{6}$' then
          raise exception using errcode='22023',message='Use a six-digit hex color.';
        end if;
        if action='create' then
          select coalesce(max(position),-1)+1 into pos from public.tasks where user_id=u and category_id is not distinct from cat;
          insert into public.tasks(id,user_id,name,category_id,color,position) values(id,u,btrim(op->>'name'),cat,coalesce(op->>'color','#61afef'),pos);
        end if;
        update public.tasks set
          name=case when op ? 'name' then btrim(op->>'name') else name end,
          color=case when op ? 'color' then op->>'color' else color end,
          category_id=cat,
          position=case when action='update' and cat is distinct from t.category_id then
            (select coalesce(max(x.position),-1)+1 from public.tasks x where x.user_id=u and x.category_id is not distinct from cat) else position end,
          completed_at=case when op ? 'completed' then case when (op->>'completed')::boolean then coalesce(completed_at,now()) else null end else completed_at end,
          notes=case when op ? 'notes' then nullif(op->>'notes','') else notes end,
          due_date=case when op ? 'due_date' then (op->>'due_date')::date else due_date end,
          priority=case when op ? 'priority' then op->>'priority' else priority end,
          reference_url=case when op ? 'reference_url' then nullif(op->>'reference_url','') else reference_url end
        where tasks.id=id and user_id=u;
      elsif action in ('trash','restore') then
        update public.tasks set deleted_at=case when action='trash' then coalesce(deleted_at,now()) else null end where tasks.id=id and user_id=u;
      elsif action='reorder' then
        pos:=(op->>'position')::double precision;
        if pos is null or not (pos between -1000000000 and 1000000000) then raise exception using errcode='22023',message='Invalid position.'; end if;
        update public.tasks set position=pos where tasks.id=id and user_id=u;
        with ordered as (select x.id,row_number() over(order by x.position,x.created_at,x.id)-1 as p
          from public.tasks x where x.user_id=u and x.category_id is not distinct from t.category_id
            and (x.completed_at is null)=(t.completed_at is null))
        update public.tasks x set position=o.p from ordered o where x.id=o.id;
      else raise exception using errcode='22023',message='Unknown task action.'; end if;
      select to_jsonb(x) into row_data from public.tasks x where x.id=id and x.user_id=u;
    elsif kind='categories' then
      perform private.flowtime_keys(op,array['action','id','name','color','archived','position']);
      select * into c from public.categories where categories.id=id and user_id=u for update;
      if action<>'create' and c.id is null then raise exception using errcode='P0002',message='Category not found.'; end if;
      if action in ('create','update') then
        if (action='create' or op ? 'name') and length(btrim(coalesce(op->>'name',''))) not between 1 and 200 then raise exception using errcode='22023',message='Names must contain 1–200 characters.'; end if;
        if op ? 'color' and (op->>'color' is null or op->>'color' !~ '^#[0-9A-Fa-f]{6}$') then raise exception using errcode='22023',message='Use a six-digit hex color.'; end if;
        if action='create' then
          select coalesce(max(position),-1)+1 into pos from public.categories where user_id=u;
          insert into public.categories(id,user_id,name,color,position) values(id,u,btrim(op->>'name'),coalesce(op->>'color','#61afef'),pos);
        end if;
        update public.categories set name=case when op ? 'name' then btrim(op->>'name') else name end,
          color=case when op ? 'color' then op->>'color' else color end,
          archived_at=case when op ? 'archived' then case when (op->>'archived')::boolean then coalesce(archived_at,now()) else null end else archived_at end
        where categories.id=id and user_id=u;
      elsif action in ('trash','restore') then
        update public.categories set deleted_at=case when action='trash' then coalesce(deleted_at,now()) else null end where categories.id=id and user_id=u;
      elsif action='reorder' then
        pos:=(op->>'position')::double precision;
        if pos is null or not(pos between -1000000000 and 1000000000) then raise exception using errcode='22023',message='Invalid position.'; end if;
        update public.categories set position=pos where categories.id=id and user_id=u;
        with ordered as (select x.id,row_number() over(order by x.position,x.created_at,x.id)-1 as p from public.categories x where x.user_id=u)
        update public.categories x set position=o.p from ordered o where x.id=o.id;
      else raise exception using errcode='22023',message='Unknown category action.'; end if;
      select to_jsonb(x) into row_data from public.categories x where x.id=id and x.user_id=u;
    elsif kind='sessions' then
      perform private.flowtime_keys(op,array['action','id','task_id','started_at','ended_at','work_seconds','break_seconds','notes']);
      select * into s from public.sessions where sessions.id=id and user_id=u for update;
      if action<>'create' and s.id is null then raise exception using errcode='P0002',message='Session not found.'; end if;
      if action in ('trash','restore') then
        update public.sessions set deleted_at=case when action='trash' then coalesce(deleted_at,now()) else null end where sessions.id=id and user_id=u;
      elsif action in ('create','update') then
        start_time:=coalesce((op->>'started_at')::timestamptz,s.started_at);
        end_time:=coalesce((op->>'ended_at')::timestamptz,s.ended_at);
        work:=coalesce((op->>'work_seconds')::integer,s.work_seconds);
        rest:=coalesce((op->>'break_seconds')::integer,s.break_seconds,0);
        if start_time is null or end_time is null or work is null or end_time<=start_time or work<0 or rest<0
          or work>ceil(extract(epoch from end_time-start_time)) or end_time>clock_timestamp()+interval '5 seconds' then
          raise exception using errcode='22023',message='Supply valid past timestamps and nonnegative durations within elapsed time.';
        end if;
        if length(op->>'notes')>4000 then raise exception using errcode='22023',message='Notes must be at most 4000 characters.'; end if;
        if action='create' then
          insert into public.sessions(id,user_id,started_at,ended_at,work_seconds,break_seconds,entry_source)
            values(id,u,start_time,end_time,work,rest,'manual');
        end if;
        update public.sessions set started_at=start_time,ended_at=end_time,work_seconds=work,break_seconds=rest,
          notes=case when op ? 'notes' then nullif(op->>'notes','') else notes end,
          edited_at=case when action='update' then now() else null end
          where sessions.id=id and user_id=u;
        if op ? 'task_id' and (action='create' or (op->>'task_id')::uuid is distinct from s.task_id) then
          if op->>'task_id' is not null then snap:=private.flowtime_task(u,(op->>'task_id')::uuid,false); else snap:='{}'; end if;
          update public.sessions set task_id=(op->>'task_id')::uuid,task_id_snapshot=(snap->>'selectedTaskId')::uuid,
            task_name_snapshot=snap->>'selectedTaskName',task_color_snapshot=snap->>'selectedTaskColor',
            category_id_snapshot=(snap->>'selectedCategoryId')::uuid,category_name_snapshot=snap->>'selectedCategoryName',
            category_color_snapshot=snap->>'selectedCategoryColor' where sessions.id=id and user_id=u;
        end if;
      else raise exception using errcode='22023',message='Unknown session action.'; end if;
      select to_jsonb(x) into row_data from public.sessions x where x.id=id and x.user_id=u;
    else raise exception using errcode='22023',message='Unknown resource.'; end if;
    result:=result||jsonb_build_array(row_data);
  end loop;
  return jsonb_build_object('items',result);
end $$;

create function private.flowtime_settings(u uuid, input jsonb) returns jsonb
language plpgsql set search_path = '' as $$
#variable_conflict use_variable
declare s public.user_settings; rev uuid; zone text;
begin
  perform private.flowtime_keys(input,array['expected_revision','timezone','break_divisor','chime_enabled','chime_id','focus_mode_lock','shortcuts_enabled','reset']);
  select * into s from public.user_settings where user_id=u for update;
  if s.revision is distinct from (input->>'expected_revision')::uuid then raise exception using errcode='40001',message='Settings changed. Refresh before retrying.'; end if;
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

create function private.flowtime_command(operation text, input jsonb, request_id uuid) returns jsonb
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

create function private.flowtime_access(client uuid, approve boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare u uuid:=private.flowtime_actor(false); result jsonb;
begin
  if auth.jwt()->>'client_id' is not null or auth.jwt()->>'is_anonymous'='true' then
    raise exception using errcode='42501',message='Only your signed-in Flowtime browser can change agent permissions.';
  end if;
  if approve is not null then
    if not exists(select 1 from private.flowtime_agent_clients where client_id=client) then raise exception using errcode='42501',message='Untrusted client.'; end if;
    insert into private.flowtime_agent_access(user_id,client_id,approved_at) values(u,client,case when approve then now() else null end)
      on conflict(user_id,client_id) do update set version=2,approved_at=excluded.approved_at;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('client_id',c.client_id,'approved',a.approved_at is not null,'version',2)),'[]') into result
    from private.flowtime_agent_clients c left join private.flowtime_agent_access a on a.client_id=c.client_id and a.user_id=u;
  return jsonb_build_object('items',result);
end $$;

create function private.flowtime_summary(u uuid, input jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
#variable_conflict use_variable
declare zone text; a timestamptz; b timestamptz; anchor date; period text:=input->>'period';
  off integer:=coalesce((input->>'offset')::integer,0); lim integer:=coalesce((input->>'limit')::integer,100); result jsonb;
begin
  zone:=coalesce(input->>'timezone',(select timezone from public.user_settings where user_id=u),'UTC');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception using errcode='22023',message='Invalid timezone.'; end if;
  if period is not null then
    anchor:=coalesce((input->>'anchor')::date,(now() at time zone zone)::date);
    if period='day' then a:=anchor::timestamp at time zone zone; b:=(anchor+1)::timestamp at time zone zone;
    elsif period='week' then anchor:=anchor-extract(dow from anchor)::integer; a:=anchor::timestamp at time zone zone; b:=(anchor+7)::timestamp at time zone zone;
    elsif period='month' then a:=date_trunc('month',anchor::timestamp) at time zone zone; b:=(date_trunc('month',anchor::timestamp)+interval '1 month') at time zone zone;
    elsif period='year' then a:=date_trunc('year',anchor::timestamp) at time zone zone; b:=(date_trunc('year',anchor::timestamp)+interval '1 year') at time zone zone;
    else raise exception using errcode='22023',message='Invalid calendar period.'; end if;
  else
    select coalesce((input->>'from')::timestamptz,min(started_at),now()),coalesce((input->>'to')::timestamptz,max(ended_at),now()+interval '1 second') into a,b
      from public.sessions where user_id=u and deleted_at is null;
  end if;
  if b<=a then raise exception using errcode='22023',message='Use an increasing date range.'; end if;
  with selected as (
    select s.started_at,s.ended_at,s.work_seconds,
      case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.task_id_snapshot else t.id end as task_id_snapshot,
      case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.task_name_snapshot else t.name end as task_name_snapshot,
      case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.task_color_snapshot else t.color end as task_color_snapshot,
      case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.category_id_snapshot else c.id end as category_id_snapshot,
      case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.category_name_snapshot else c.name end as category_name_snapshot,
      case when s.task_id_snapshot is not null or s.task_name_snapshot is not null then s.category_color_snapshot else c.color end as category_color_snapshot,
      greatest(s.started_at,a) as lo,least(s.ended_at,b) as hi,
      case when s.ended_at>s.started_at then greatest(0,
        round(s.work_seconds::numeric*extract(epoch from least(s.ended_at,b)-s.started_at)/extract(epoch from s.ended_at-s.started_at))-
        round(s.work_seconds::numeric*extract(epoch from greatest(s.started_at,a)-s.started_at)/extract(epoch from s.ended_at-s.started_at)))::integer
        else s.work_seconds end as seconds
    from public.sessions s left join public.tasks t on t.id=s.task_id and t.user_id=u left join public.categories c on c.id=t.category_id and c.user_id=u where s.user_id=u and s.deleted_at is null and s.started_at<b and s.ended_at>a
  ), task_groups as (
    select task_id_snapshot as task_id,task_name_snapshot as task_name,task_color_snapshot as color,
      category_id_snapshot as category_id,category_name_snapshot as category_name,sum(seconds) as work_seconds,count(*) as session_count
    from selected group by 1,2,3,4,5
  ), category_groups as (
    select category_id_snapshot as category_id,category_name_snapshot as category_name,category_color_snapshot as color,
      sum(seconds) as work_seconds,count(*) as session_count from selected group by 1,2,3
  ), day_slices as (
    select d::date as day,category_id_snapshot as category_id,category_name_snapshot as category_name,
      category_color_snapshot as color,
      greatest(0,round(s.work_seconds::numeric*extract(epoch from least(s.hi,(d+interval '1 day') at time zone zone)-s.started_at)/extract(epoch from s.ended_at-s.started_at))-
      round(s.work_seconds::numeric*extract(epoch from greatest(s.lo,d at time zone zone)-s.started_at)/extract(epoch from s.ended_at-s.started_at)))::integer as seconds
    from selected s cross join lateral generate_series((s.lo at time zone zone)::date::timestamp,
      ((s.hi-interval '1 microsecond') at time zone zone)::date::timestamp,interval '1 day') d where s.ended_at>s.started_at
  ), day_categories as (
    select day,category_id,category_name,color,sum(seconds) as seconds from day_slices group by 1,2,3,4
  ), days as (
    select day as date,sum(seconds) as work_seconds,jsonb_agg(jsonb_build_object('category_id',category_id,
      'category_name',category_name,'color',color,'work_seconds',seconds) order by seconds desc,category_id) as by_category
      from day_categories group by day
  ), hour_slices as (
    select to_char(h at time zone zone,'YYYY-MM-DD"T"HH24') as hour,
      category_id_snapshot as category_id,category_name_snapshot as category_name,category_color_snapshot as color,
      greatest(0,round(s.work_seconds::numeric*extract(epoch from least(s.hi,h+interval '1 hour')-s.started_at)/extract(epoch from s.ended_at-s.started_at))-
      round(s.work_seconds::numeric*extract(epoch from greatest(s.lo,h)-s.started_at)/extract(epoch from s.ended_at-s.started_at)))::integer as seconds
    from selected s cross join lateral generate_series(date_trunc('hour',s.lo,zone),s.hi-interval '1 microsecond',interval '1 hour') h
    where s.ended_at>s.started_at and period='day'
  ), hour_categories as (
    select hour,category_id,category_name,color,sum(seconds) as seconds from hour_slices group by 1,2,3,4
  ), hours as (
    select hour as date,sum(seconds) as work_seconds,jsonb_agg(jsonb_build_object('category_id',category_id,'category_name',category_name,'color',color,'work_seconds',seconds) order by seconds desc,category_id) as by_category from hour_categories group by hour
  ), all_days as (
    select distinct d::date as day from public.sessions s cross join lateral generate_series(
      (s.started_at at time zone zone)::date::timestamp,
      ((s.ended_at-interval '1 microsecond') at time zone zone)::date::timestamp,interval '1 day') d
      where s.user_id=u and s.deleted_at is null and s.work_seconds>0 and s.ended_at>s.started_at
  ), numbered as (select day,day-(row_number() over(order by day))::integer as island from all_days),
  streaks as (select min(day) as first,max(day) as last,count(*) as length from numbered group by island)
  select jsonb_build_object('from',a,'to',b,'timezone',zone,'work_seconds',coalesce((select sum(seconds) from selected),0),
    'session_count',(select count(*) from selected),'excludes_unsaved_work',true,
    'current_streak',coalesce((select length from streaks where last=(now() at time zone zone)::date),0),
    'longest_streak',coalesce((select max(length) from streaks),0),
    'by_task_snapshot',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from task_groups order by work_seconds desc,task_id,task_name,category_id,category_name,color limit lim offset off) x),'[]'),
    'by_category_snapshot',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from category_groups order by work_seconds desc,category_id,category_name,color limit lim offset off) x),'[]'),
    'by_hour',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from hours order by date) x),'[]'),
    'by_day',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from days order by date limit lim offset off) x),'[]'),
    'next_offset',case when greatest((select count(*) from task_groups),(select count(*) from category_groups),(select count(*) from days))>off+lim then off+lim else null end)
    into result;
  return result;
end $$;

create function private.flowtime_read(operation text, input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare u uuid:=private.flowtime_actor(operation in ('session','settings') or coalesce(input->>'trash','exclude')<>'exclude');
  lim integer:=coalesce((input->>'limit')::integer,50); off integer:=coalesce((input->>'offset')::integer,0);
  rev bigint; fingerprint text; rows jsonb; total bigint; state jsonb; timer_rev uuid; result jsonb;
  zone text; from_time timestamptz:=(input->>'from')::timestamptz; to_time timestamptz:=(input->>'to')::timestamptz;
begin
  if lim not between 1 and 100 or off<0 or octet_length(input::text)>16384 then raise exception using errcode='22023',message='Invalid page or payload size.'; end if;
  if from_time is not null and to_time is not null and to_time<=from_time then raise exception using errcode='22023',message='Use an increasing date range.'; end if;
  select coalesce((select revision from private.flowtime_revisions where user_id=u and dataset=case when operation in ('summary','session') then 'sessions' else operation end),0) into rev;
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

create function private.flowtime_task_write_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.jwt()->>'client_id' is not null and current_setting('flowtime.command',true) is distinct from 'on' then
    if tg_op='INSERT' then
      if new.deleted_at is not null or new.notes is not null or new.due_date is not null or new.priority is not null or new.reference_url is not null then
        raise exception using errcode='42501',message='Use approved expanded-control operations for task context and trash.';
      end if;
    elsif row(new.deleted_at,new.notes,new.due_date,new.priority,new.reference_url) is distinct from row(old.deleted_at,old.notes,old.due_date,old.priority,old.reference_url) then
      raise exception using errcode='42501',message='Use approved expanded-control operations for task context and trash.';
    end if;
  end if;
  return new;
end $$;
create trigger flowtime_task_write_boundary before insert or update on public.tasks for each row execute function private.flowtime_task_write_guard();

create function public.flowtime_command(operation text,input jsonb,request_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.flowtime_command(operation,input,request_id) $$;
create function public.flowtime_read(operation text,input jsonb default '{}') returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.flowtime_read(operation,input) $$;
create function public.flowtime_access(client uuid default null,approve boolean default null) returns jsonb
language sql security invoker set search_path = '' as $$ select private.flowtime_access(client,approve) $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.flowtime_command(text,jsonb,uuid),public.flowtime_read(text,jsonb),public.flowtime_access(uuid,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.flowtime_command(text,jsonb,uuid),private.flowtime_read(text,jsonb),private.flowtime_access(uuid,boolean) to authenticated;
grant execute on function public.flowtime_command(text,jsonb,uuid),public.flowtime_read(text,jsonb),public.flowtime_access(uuid,boolean) to authenticated;
-- Revoke-all above must not disable the existing Auth token hook.
grant execute on function private.flowtime_agent_token_hook(jsonb) to supabase_auth_admin;
