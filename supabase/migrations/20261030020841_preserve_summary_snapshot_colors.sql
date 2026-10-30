-- Keep snapshot colors consistent with the existing browser attribution rules.
create or replace function private.flowtime_summary(u uuid, input jsonb) returns jsonb
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
    select task_id_snapshot as task_id,task_name_snapshot as task_name,coalesce(category_color_snapshot,task_color_snapshot) as color,
      category_id_snapshot as category_id,category_name_snapshot as category_name,sum(seconds) as work_seconds,count(*) as session_count
    from selected group by 1,2,3,4,5
  ), category_groups as (
    select category_id_snapshot as category_id,category_name_snapshot as category_name,coalesce(category_color_snapshot,task_color_snapshot) as color,
      sum(seconds) as work_seconds,count(*) as session_count from selected group by 1,2,3
  ), day_slices as (
    select d::date as day,category_id_snapshot as category_id,category_name_snapshot as category_name,
      coalesce(category_color_snapshot,task_color_snapshot) as color,
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
      category_id_snapshot as category_id,category_name_snapshot as category_name,coalesce(category_color_snapshot,task_color_snapshot) as color,
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

