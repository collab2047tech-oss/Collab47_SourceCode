-- Materialised views for Popular and Trending tabs.

create materialized view public.popular_posts as
select
  p.id,
  p.author_id,
  p.body,
  p.image_urls,
  p.hashtags,
  p.branch_tags,
  p.city_tags,
  p.like_count,
  p.comment_count,
  p.repost_count,
  p.created_at,
  (p.like_count + 2*p.comment_count + 3*p.repost_count + p.bookmark_count)::float
    / greatest(extract(epoch from (now() - p.created_at))/3600, 1)  -- per-hour score
    as hot_score
from public.posts p
where p.created_at > now() - interval '24 hours'
  and (p.expires_at is null or p.expires_at > now())
order by hot_score desc
limit 200;

create unique index on public.popular_posts (id);
create index on public.popular_posts (hot_score desc);

create materialized view public.trending_posts as
select
  p.id,
  p.author_id,
  p.body,
  p.image_urls,
  p.hashtags,
  p.branch_tags,
  p.city_tags,
  p.like_count,
  p.comment_count,
  p.repost_count,
  p.created_at,
  (p.like_count + 3*p.comment_count + 4*p.repost_count)::float
    / greatest(extract(epoch from (now() - p.created_at))/3600, 1) as spike_score
from public.posts p
where p.created_at > now() - interval '6 hours'
  and (p.expires_at is null or p.expires_at > now())
order by spike_score desc
limit 500;

create unique index on public.trending_posts (id);
create index on public.trending_posts (spike_score desc);
create index on public.trending_posts using gin (branch_tags);
create index on public.trending_posts using gin (city_tags);

-- ====================================================================
-- Founder review queue (admin SQL view)
-- ====================================================================
create or replace view public.moderation_queue as
select
  r.id,
  r.category,
  r.body                                 as report_body,
  r.created_at                           as reported_at,
  r.reporter_id,
  rep_profile.handle                     as reporter_handle,
  r.post_id,
  r.profile_id,
  p.body                                 as post_body,
  p.like_count,
  p.created_at                           as post_created_at,
  prof.handle                            as target_handle,
  prof.suspended_at                      as target_suspended_at,
  (select count(*) from public.reports r2 where r2.post_id = r.post_id or r2.profile_id = r.profile_id) as report_total
from public.reports r
left join public.posts    p           on p.id  = r.post_id
left join public.profiles prof        on prof.id = coalesce(p.author_id, r.profile_id)
left join public.profiles rep_profile on rep_profile.id = r.reporter_id
where r.resolved_at is null
order by report_total desc, r.created_at asc;

-- Helper view: connection status for a pair (canonical)
create or replace view public.connection_status as
select
  least(user_a_id, user_b_id)   as user_a,
  greatest(user_a_id, user_b_id) as user_b,
  status,
  accepted_at,
  created_at
from public.connections;

-- ====================================================================
-- pg_cron jobs (run after pg_cron extension enabled in Supabase Dashboard)
-- ====================================================================
-- select cron.schedule('refresh-popular', '*/10 * * * *',
--   'refresh materialized view concurrently public.popular_posts');
-- select cron.schedule('refresh-trending', '*/10 * * * *',
--   'refresh materialized view concurrently public.trending_posts');
-- select cron.schedule('purge-seen-posts', '0 4 * * *',
--   'delete from public.user_seen_posts where seen_at < now() - interval ''7 days''');
-- select cron.schedule('expire-posts', '0 * * * *',
--   'update public.posts set image_urls = ''{}'', video_url = null where expires_at is not null and expires_at < now() and not is_highlight');
