-- 0031_posts_realtime.sql
-- Enable Supabase Realtime on public.posts so the feed receives live count
-- updates (like_count / comment_count / repost_count / bookmark_count) when ANY
-- user reacts, comments, reposts, or saves. The engagement counters are already
-- maintained by SECURITY DEFINER triggers (0010-0012), so every reaction fires
-- an UPDATE on the post row; this publishes that UPDATE to subscribers.
--
-- Only the new row image is needed (counts live in NEW), so REPLICA IDENTITY
-- stays DEFAULT - posts is a high-write table and FULL identity would bloat WAL
-- for no benefit here. RLS still applies to Realtime: a subscriber receives a
-- change only for rows it can SELECT, so private-author posts never leak.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end
$$;
