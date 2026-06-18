-- Day 7: Moderation. 3-strike auto-hide, deleted_at column, suspended_users view.

alter table public.posts add column if not exists deleted_at timestamptz;
create index if not exists posts_deleted_at_idx on public.posts (deleted_at) where deleted_at is not null;

-- 3-strike auto-hide trigger.
-- On insert into reports, count existing reports on the same target.
-- If >= 3 valid (not yet resolved) reports, mark target hidden.
create or replace function public.tg_three_strike_autohide() returns trigger language plpgsql as $$
declare
  total_reports int;
begin
  if new.post_id is not null then
    select count(*) into total_reports
      from public.reports
      where post_id = new.post_id and resolved_at is null;
    if total_reports >= 3 then
      update public.posts
        set deleted_at = coalesce(deleted_at, now())
        where id = new.post_id;
    end if;
  elsif new.profile_id is not null then
    select count(*) into total_reports
      from public.reports
      where profile_id = new.profile_id and resolved_at is null;
    if total_reports >= 3 then
      update public.profiles
        set suspended_at = coalesce(suspended_at, now())
        where id = new.profile_id;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists reports_three_strike on public.reports;
create trigger reports_three_strike
  after insert on public.reports
  for each row execute function public.tg_three_strike_autohide();

-- Suspended users view (for founder dashboard).
create or replace view public.suspended_users as
select
  id, handle, name, college, suspended_at,
  (select count(*) from public.reports r where r.profile_id = profiles.id) as report_count
from public.profiles
where suspended_at is not null
order by suspended_at desc;
