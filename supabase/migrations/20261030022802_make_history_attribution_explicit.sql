-- Omitted attribution is preserved; an explicitly supplied task_id always corrects the snapshots.
create or replace function private.flowtime_manage(u uuid, kind text, operations jsonb) returns jsonb
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
        if op ? 'task_id' then
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

