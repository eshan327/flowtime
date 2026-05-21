alter table public.sessions
add column if not exists notes text;

comment on column public.sessions.notes is 'Optional freeform note for a completed focus session.';
