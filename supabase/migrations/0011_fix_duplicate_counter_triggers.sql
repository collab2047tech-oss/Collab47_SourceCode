-- ========================================================================
-- Fix: migration 0001 already defined like/comment/bookmark count triggers
-- (likes_count_t etc). Migration 0010 added a SECOND set (likes_count_trg)
-- without dropping the originals, so counters double-incremented.
-- Keep the 0010 set (they have greatest(0,...) underflow guards) and drop the
-- 0001 originals. The repost trigger (reposts_count_trg) is unique - keep it.
-- ========================================================================

drop trigger if exists likes_count_t     on public.likes;
drop trigger if exists comments_count_t  on public.comments;
drop trigger if exists bookmarks_count_t on public.bookmarks;

-- Re-backfill to correct any values skewed while both sets were active.
update public.posts p set
  like_count     = (select count(*) from public.likes l     where l.post_id = p.id),
  comment_count  = (select count(*) from public.comments c  where c.post_id = p.id),
  bookmark_count = (select count(*) from public.bookmarks b  where b.post_id = p.id),
  repost_count   = (select count(*) from public.posts r where r.reposted_from_post_id = p.id and r.is_repost);
