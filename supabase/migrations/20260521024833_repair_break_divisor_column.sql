alter table public.categories
	add column if not exists break_divisor numeric(4,2);

update public.categories
set break_divisor = 1.00
where break_divisor is null;

alter table public.categories
	alter column break_divisor set default 1.00;

alter table public.categories
	alter column break_divisor set not null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'categories_break_divisor_check'
			and conrelid = 'public.categories'::regclass
	) then
		alter table public.categories
			add constraint categories_break_divisor_check
			check (break_divisor >= 0.50 and break_divisor <= 1.50);
	end if;
end
$$;
