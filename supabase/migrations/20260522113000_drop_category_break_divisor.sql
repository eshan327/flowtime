alter table public.categories
  drop constraint if exists categories_break_divisor_check;

alter table public.categories
  drop constraint if exists categories_break_divisor_range_check;

alter table public.categories
  drop column if exists break_divisor;
