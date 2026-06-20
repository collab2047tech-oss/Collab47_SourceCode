alter table public.profiles add column if not exists links jsonb not null default '{}'::jsonb;
