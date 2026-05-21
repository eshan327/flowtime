alter table public.categories
add column if not exists break_divisor integer;

comment on column public.categories.break_divisor is 'Optional per-category break divisor override. NULL uses global timer setting.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_break_divisor_range_check'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
    add constraint categories_break_divisor_range_check
    check (break_divisor is null or break_divisor between 2 and 10);
  end if;
end
$$;
