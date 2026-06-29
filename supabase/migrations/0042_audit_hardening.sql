-- 0042_audit_hardening.sql
-- Adversarial-audit hardening batch.

-- 1) IMPRESSION INFLATION: bump_impressions was unconditional +1 (idempotency
--    "enforced upstream" was a lie). Make it idempotent per (user, post): only
--    the FIRST time a user sees a post counts. Inserting the seen row and
--    incrementing only newly-inserted rows removes the inflate-a-rival vector.
create or replace function public.bump_impressions(ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh uuid[];
begin
  if auth.uid() is null then return; end if;
  if ids is null or cardinality(ids) = 0 or cardinality(ids) > 50 then return; end if;
  with ins as (
    insert into public.user_seen_posts (user_id, post_id)
    select auth.uid(), x from unnest(ids) as x
    on conflict (user_id, post_id) do nothing
    returning post_id
  )
  select array_agg(post_id) into fresh from ins;
  if fresh is not null then
    update public.posts set impressions = impressions + 1 where id = any(fresh);
  end if;
end;
$$;

-- 2) PROJECTS mass-assignment: proj_update_own has no column restriction, so an
--    author could self-set status='delivered' / delivered_at / deliverable_url
--    (fake public delivery). All legit transitions go through the admin client
--    (acceptApplicant / markDelivered), so revert these for end-user updates.
create or replace function public.guard_projects_privileged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.status          := old.status;
    new.delivered_at     := old.delivered_at;
    new.deliverable_url  := old.deliverable_url;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_projects_privileged on public.projects;
create trigger trg_guard_projects_privileged
  before update on public.projects
  for each row execute function public.guard_projects_privileged();

-- 3) LIKES repoint: the likes UPDATE policy allowed changing post_id/user_id
--    (counter desync). Only the reaction column should ever be updated.
revoke update on public.likes from authenticated;
grant  update (reaction) on public.likes to authenticated;

-- 4) STORAGE: enforce server-side size + content-type caps (client checks are
--    bypassable by calling the Storage REST API directly).
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
  where id in ('avatars','covers');
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
  where id = 'message-media';
update storage.buckets set file_size_limit = 104857600,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
                             'video/mp4','video/quicktime','video/webm']
  where id = 'post-media';

-- 5) REPORT-BOMBING: one report per (reporter, target). Partial-unique indexes
--    so a user contributes at most one report per post/profile/news item.
create unique index if not exists reports_reporter_post_uniq    on public.reports (reporter_id, post_id)    where post_id is not null;
create unique index if not exists reports_reporter_profile_uniq on public.reports (reporter_id, profile_id) where profile_id is not null;
create unique index if not exists reports_reporter_news_uniq    on public.reports (reporter_id, news_id)    where news_id is not null;
