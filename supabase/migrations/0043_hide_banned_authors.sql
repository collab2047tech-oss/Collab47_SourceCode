-- 0043_hide_banned_authors.sql
-- HIGH: posts_read_public hid a post only by its OWN deleted_at + the author's
-- is_private flag - never the author's deleted_at / suspended_at. So a
-- soft-deleted or admin-suspended (3-strike) user kept full reach across
-- For-You/Recent/Popular/Trending/tag/detail and any direct profile-post read.
-- Extend the policy to also require the author account be live (not deleted, not
-- suspended). One policy covers every RLS-gated post read. Reversible on unban.

drop policy if exists posts_read_public on public.posts;
create policy posts_read_public on public.posts
  for select using (
    deleted_at is null
    and exists (
      select 1 from public.profiles pr
      where pr.id = posts.author_id
        and pr.deleted_at is null
        and pr.suspended_at is null
        and (pr.is_private is not true or pr.id = auth.uid() or public.is_connected(auth.uid(), pr.id))
    )
  );

-- search_posts is a stable function that joins posts->profiles but filtered only
-- po.deleted_at - never the author's status. Recreate EXACTLY as defined (prefix
-- tsquery CTE + recency-decayed rank) with the author-status gate added.
create or replace function public.search_posts(q text, lim integer default 4)
returns table(id uuid, short_id text, body text, created_at timestamp with time zone,
              like_count integer, author_handle text, author_name text,
              author_avatar text, rank real)
language sql stable set search_path to 'public'
as $function$
  with terms as (
    select string_agg(t || ':*', ' & ') as pref
    from regexp_split_to_table(lower(trim(q)), '\s+') as t where length(t) > 0
  )
  select po.id, po.short_id, po.body, po.created_at, po.like_count,
         a.handle, a.name, a.avatar_url,
         ts_rank(po.search_tsv, to_tsquery('simple', (select pref from terms)))
           + ln(1 + po.like_count) * 0.05
           - extract(epoch from (now() - po.created_at))/864000.0 * 0.01 as rank
  from public.posts po
  join public.profiles a on a.id = po.author_id
  , terms
  where po.deleted_at is null
    and a.deleted_at is null
    and a.suspended_at is null
    and (po.expires_at is null or po.expires_at > now())
    and terms.pref is not null
    and po.search_tsv @@ to_tsquery('simple', terms.pref)
  order by rank desc
  limit lim;
$function$;
