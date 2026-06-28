-- ===========================================================================
-- 0027_trending_and_search.sql
-- Phase 2 (DISCOVERY): make trending REAL and search ranked + typo-tolerant.
-- Applied live via the Management API like prior migrations; this file is the
-- repo record.
--
-- Part A - Trending: the dead `hashtags` / `post_hashtags` tables are never
--   written, so `hashtags.use_count` is always 0 and trending is faked from a
--   tiny post sample. A trigger now keeps both tables in sync from
--   `posts.hashtags` on insert/update/delete, plus an honest recompute fn, a
--   backfill, and a windowed `trending_tags` RPC (velocity + spam guard).
--
-- Part B - Search: FTS `search_tsv` + pg_trgm already exist but `searchAll`
--   uses neither prefix nor fuzzy matching and never ranks. New
--   SECURITY INVOKER RPCs do tiered prefix + trigram ranking server-side so
--   RLS still applies and we do one indexed round trip per type.
-- ===========================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- PART A - TRENDING
-- ---------------------------------------------------------------------------

-- (a) Keep post_hashtags + hashtags in sync from posts.hashtags on every
--     insert/update of the array (and clean up on delete). SECURITY DEFINER so
--     it can write the shared hashtags table regardless of who owns the post.
create or replace function public.sync_post_hashtags()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare t text;
begin
  if (TG_OP = 'DELETE') then
    delete from public.post_hashtags where post_id = old.id;
    return old;
  end if;

  if (TG_OP in ('INSERT','UPDATE')) then
    -- ensure each tag row exists, then link it to this post
    foreach t in array coalesce(new.hashtags, '{}') loop
      t := lower(trim(both '#' from t));
      if length(t) = 0 then continue; end if;
      insert into public.hashtags (tag) values (t) on conflict (tag) do nothing;
      insert into public.post_hashtags (post_id, tag) values (new.id, t)
        on conflict do nothing;
    end loop;
    -- remove links no longer present on the row (edit path)
    delete from public.post_hashtags ph
      where ph.post_id = new.id
        and not (ph.tag = any (
          select lower(trim(both '#' from x))
          from unnest(coalesce(new.hashtags, '{}')) x
        ));
  end if;
  return new;
end $fn$;

drop trigger if exists trg_sync_post_hashtags_ins on public.posts;
create trigger trg_sync_post_hashtags_ins
  after insert or update of hashtags on public.posts
  for each row execute function public.sync_post_hashtags();

drop trigger if exists trg_sync_post_hashtags_del on public.posts;
create trigger trg_sync_post_hashtags_del
  after delete on public.posts
  for each row execute function public.sync_post_hashtags();

-- (b) use_count = honest count of LIVE (non-deleted, non-expired) posts per tag.
--     Recomputed in bulk rather than kept as a drifting monotonic counter.
create or replace function public.recompute_hashtag_counts()
returns void language sql security definer set search_path = public as $fn$
  update public.hashtags h set use_count = coalesce(sub.c, 0)
  from (
    select t.tag, count(*)::int c
    from public.hashtags t
    left join public.post_hashtags ph on ph.tag = t.tag
    left join public.posts p
      on p.id = ph.post_id
     and p.deleted_at is null
     and (p.expires_at is null or p.expires_at > now())
    group by t.tag
  ) sub
  where sub.tag = h.tag;
$fn$;

-- (c) Backfill. Insert hashtags FIRST (post_hashtags.tag FKs to hashtags.tag),
--     then post_hashtags, then recompute counts.
insert into public.hashtags (tag)
select distinct lower(trim(both '#' from t))
from public.posts p, unnest(p.hashtags) t
where length(lower(trim(both '#' from t))) > 0
on conflict do nothing;

insert into public.post_hashtags (post_id, tag)
select p.id, lower(trim(both '#' from t))
from public.posts p, unnest(p.hashtags) t
where length(lower(trim(both '#' from t))) > 0
on conflict do nothing;

select public.recompute_hashtag_counts();

create index if not exists post_hashtags_tag_idx  on public.post_hashtags (tag);
create index if not exists post_hashtags_post_idx on public.post_hashtags (post_id);
create index if not exists hashtags_use_count_idx on public.hashtags (use_count desc);

-- (d) Windowed per-tag trending stats: in-window count, prior-window count (for
--     velocity), distinct authors (spam guard), and recent engagement sum.
--     STABLE; the heavy aggregate runs in Postgres over indexed post_hashtags.
create or replace function public.trending_tags(
  win_hours int default 24,
  max_tags  int default 40
) returns table (
  tag text, posts_window int, posts_prior int, authors int,
  engagement numeric, last_post timestamptz
) language sql stable set search_path = public as $fn$
  with recent as (
    select ph.tag, p.id, p.author_id, p.created_at,
           (p.like_count + 2*p.comment_count + 3*p.repost_count + p.bookmark_count) eng
    from public.post_hashtags ph
    join public.posts p on p.id = ph.post_id
    where p.deleted_at is null and (p.expires_at is null or p.expires_at > now())
      and p.created_at > now() - make_interval(hours => win_hours * 2)
  )
  select
    tag,
    count(*) filter (where created_at > now() - make_interval(hours => win_hours))::int,
    count(*) filter (where created_at <= now() - make_interval(hours => win_hours))::int,
    count(distinct author_id) filter (where created_at > now() - make_interval(hours => win_hours))::int,
    coalesce(sum(eng) filter (where created_at > now() - make_interval(hours => win_hours)), 0),
    max(created_at)
  from recent
  group by tag
  having count(*) filter (where created_at > now() - make_interval(hours => win_hours)) > 0
  order by count(*) filter (where created_at > now() - make_interval(hours => win_hours)) desc
  limit max_tags * 3;  -- over-fetch; Node re-ranks by velocity + personalisation
$fn$;

-- ---------------------------------------------------------------------------
-- PART B - SEARCH (prefix + trigram, ranked)
-- ---------------------------------------------------------------------------

-- Trigram indexes for fuzzy/prefix on the columns search hits hardest.
create index if not exists hashtags_tag_trgm_idx
  on public.hashtags using gin (tag gin_trgm_ops);
create index if not exists profiles_handle_trgm_idx
  on public.profiles using gin (handle gin_trgm_ops);

-- People: tiered score (exact handle > handle prefix > tsv rank > trigram sim).
-- SECURITY INVOKER (default) so profile RLS + privacy filters still apply.
create or replace function public.search_people(q text, lim int default 6)
returns table (id uuid, handle text, name text, avatar_url text,
               college text, branch text, rank real)
language sql stable set search_path = public as $$
  with terms as (
    select string_agg(t || ':*', ' & ') as pref
    from regexp_split_to_table(lower(trim(q)), '\s+') as t
    where length(t) > 0
  )
  select p.id, p.handle, p.name, p.avatar_url, p.college, p.branch,
    (case when lower(p.handle) = lower(q) then 3.0
          when lower(p.handle) like lower(q) || '%' then 2.0 else 0 end)
    + coalesce(ts_rank(p.search_tsv, to_tsquery('simple', (select pref from terms))), 0)
    + greatest(similarity(p.name, q), similarity(p.handle, q)) as rank
  from public.profiles p, terms
  where p.deleted_at is null and p.suspended_at is null
    and coalesce(p.privacy->>'searchable','true') <> 'false'
    and terms.pref is not null
    and (
      p.search_tsv @@ to_tsquery('simple', terms.pref)
      or p.name % q or p.handle % q
    )
  order by rank desc
  limit lim;
$$;

-- Posts: prefix tsv + recency/engagement boost, author joined in.
create or replace function public.search_posts(q text, lim int default 4)
returns table (id uuid, short_id text, body text, created_at timestamptz,
               like_count int, author_handle text, author_name text,
               author_avatar text, rank real)
language sql stable set search_path = public as $$
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
    and (po.expires_at is null or po.expires_at > now())
    and terms.pref is not null
    and po.search_tsv @@ to_tsquery('simple', terms.pref)
  order by rank desc
  limit lim;
$$;

-- Projects: open first, then by relevance. Status returned so the UI is honest.
create or replace function public.search_projects(q text, lim int default 4)
returns table (id uuid, short_id text, title text, brief text,
               status text, deadline date, rank real)
language sql stable set search_path = public as $$
  with terms as (
    select string_agg(t || ':*', ' & ') as pref
    from regexp_split_to_table(lower(trim(q)), '\s+') as t where length(t) > 0
  )
  select pr.id, pr.short_id, pr.title, pr.brief, pr.status, pr.deadline,
         ts_rank(pr.search_tsv, to_tsquery('simple', (select pref from terms)))
           + (case when pr.status = 'open' then 0.5 else 0 end) as rank
  from public.projects pr, terms
  where terms.pref is not null
    and pr.search_tsv @@ to_tsquery('simple', terms.pref)
  order by rank desc
  limit lim;
$$;

-- Hashtags: prefix + fuzzy, ranked by use_count.
create or replace function public.search_hashtags(q text, lim int default 6)
returns table (tag text, use_count int, rank real)
language sql stable set search_path = public as $$
  select h.tag, h.use_count,
         (case when h.tag like lower(regexp_replace(q,'^#','')) || '%' then 1.0 else 0 end)
           + similarity(h.tag, lower(regexp_replace(q,'^#',''))) as rank
  from public.hashtags h
  where h.tag % lower(regexp_replace(q,'^#',''))
     or h.tag like lower(regexp_replace(q,'^#','')) || '%'
  order by rank desc, h.use_count desc
  limit lim;
$$;

-- ---------------------------------------------------------------------------
-- College leaderboard: SQL aggregate (replaces the 1000-row pull + JS count).
-- ---------------------------------------------------------------------------
create or replace function public.college_leaderboard(lim int default 5)
returns table (college text, members int)
language sql stable set search_path = public as $$
  select p.college, count(*)::int
  from public.profiles p
  where p.deleted_at is null and p.college is not null and length(trim(p.college)) > 0
  group by p.college
  order by count(*) desc
  limit lim;
$$;
