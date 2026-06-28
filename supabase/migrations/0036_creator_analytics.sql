-- 0036_creator_analytics.sql
-- Real creator-analytics aggregations. feed_events is viewer-private (read_self
-- RLS), so an AUTHOR cannot directly read the impression events on their own
-- posts. These SECURITY DEFINER functions bypass that to return ONLY aggregate
-- counts for the caller's OWN posts (no viewer identities leak) - so the
-- analytics are real, derived from logged behaviour, never stubbed.

-- Daily impressions for the signed-in user's posts over the last `days` days.
create or replace function public.creator_impressions_daily(days int default 30)
returns table(day date, impressions bigint)
language sql
security definer
set search_path = public
as $$
  select date_trunc('day', fe.created_at)::date as day, count(*)::bigint as impressions
  from public.feed_events fe
  join public.posts p on p.id = fe.post_id
  where p.author_id = auth.uid()
    and fe.kind = 'impression'
    and fe.created_at >= now() - make_interval(days => greatest(days, 1))
  group by 1
  order by 1;
$$;

-- Daily engagements (likes) on the signed-in user's posts over the last `days`.
-- Likes are world-readable, but joining + aggregating server-side keeps it cheap
-- and consistent with the impressions series.
create or replace function public.creator_engagements_daily(days int default 30)
returns table(day date, engagements bigint)
language sql
security definer
set search_path = public
as $$
  select date_trunc('day', l.created_at)::date as day, count(*)::bigint as engagements
  from public.likes l
  join public.posts p on p.id = l.post_id
  where p.author_id = auth.uid()
    and l.created_at >= now() - make_interval(days => greatest(days, 1))
  group by 1
  order by 1;
$$;

grant execute on function public.creator_impressions_daily(int) to authenticated;
grant execute on function public.creator_engagements_daily(int) to authenticated;
