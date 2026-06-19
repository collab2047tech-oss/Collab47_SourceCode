-- ========================================================================
-- Engagement counters: keep posts.{like,comment,bookmark,repost}_count in sync
-- via triggers. Previously these columns never changed, so the UI showed wrong
-- counts and likes appeared to "reset" on reload.
-- ========================================================================

-- Likes -------------------------------------------------------------------
create or replace function public.tg_likes_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end$$;
drop trigger if exists likes_count_trg on public.likes;
create trigger likes_count_trg after insert or delete on public.likes
  for each row execute function public.tg_likes_count();

-- Comments ----------------------------------------------------------------
create or replace function public.tg_comments_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end$$;
drop trigger if exists comments_count_trg on public.comments;
create trigger comments_count_trg after insert or delete on public.comments
  for each row execute function public.tg_comments_count();

-- Bookmarks ---------------------------------------------------------------
create or replace function public.tg_bookmarks_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set bookmark_count = bookmark_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set bookmark_count = greatest(0, bookmark_count - 1) where id = old.post_id;
  end if;
  return null;
end$$;
drop trigger if exists bookmarks_count_trg on public.bookmarks;
create trigger bookmarks_count_trg after insert or delete on public.bookmarks
  for each row execute function public.tg_bookmarks_count();

-- Reposts (a repost is a posts row with is_repost + reposted_from_post_id) ---
create or replace function public.tg_reposts_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    if new.is_repost and new.reposted_from_post_id is not null then
      update public.posts set repost_count = repost_count + 1 where id = new.reposted_from_post_id;
    end if;
  elsif (tg_op = 'DELETE') then
    if old.is_repost and old.reposted_from_post_id is not null then
      update public.posts set repost_count = greatest(0, repost_count - 1) where id = old.reposted_from_post_id;
    end if;
  end if;
  return null;
end$$;
drop trigger if exists reposts_count_trg on public.posts;
create trigger reposts_count_trg after insert or delete on public.posts
  for each row execute function public.tg_reposts_count();

-- Backfill current counts so existing rows are correct immediately.
update public.posts p set
  like_count     = (select count(*) from public.likes l     where l.post_id = p.id),
  comment_count  = (select count(*) from public.comments c  where c.post_id = p.id),
  bookmark_count = (select count(*) from public.bookmarks b  where b.post_id = p.id);

update public.posts p set
  repost_count = (select count(*) from public.posts r where r.reposted_from_post_id = p.id and r.is_repost);
