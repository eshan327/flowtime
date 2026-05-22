-- Restore category break divisor semantics for Flowtime mode:
-- - Optional per-category override (NULL => use global timer setting)
-- - Integer divisor constrained to 2..10

alter table public.categories
  drop constraint if exists categories_break_divisor_check;

alter table public.categories
  drop constraint if exists categories_break_divisor_range_check;

alter table public.categories
  add column if not exists break_divisor numeric(10, 4);

alter table public.categories
  alter column break_divisor drop default;

alter table public.categories
  alter column break_divisor drop not null;

-- Legacy/bad values (<2, >10, or fractional) are treated as "no override".
update public.categories
set break_divisor = null
where break_divisor is not null
  and (
    break_divisor < 2
    or break_divisor > 10
    or break_divisor <> trunc(break_divisor)
  );

alter table public.categories
  alter column break_divisor type integer
  using case
    when break_divisor is null then null
    else break_divisor::integer
  end;

alter table public.categories
  add constraint categories_break_divisor_range_check
  check (break_divisor is null or break_divisor between 2 and 10);

comment on column public.categories.break_divisor is
  'Optional per-category break divisor override. NULL uses global timer setting.';