-- 0051_digest_optout.sql
-- Per-user opt-out for the weekly email digest. Every digest carries a one-click
-- unsubscribe link that flips this true; the cron skips opted-out users.
alter table public.profiles add column if not exists digest_opt_out boolean not null default false;
