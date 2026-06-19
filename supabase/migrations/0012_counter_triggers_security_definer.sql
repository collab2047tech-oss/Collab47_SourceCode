-- ========================================================================
-- Counter triggers must run as SECURITY DEFINER.
-- A trigger function runs in the RLS context of the user performing the
-- INSERT/DELETE. When user A likes user B's post, the trigger's
-- `UPDATE posts SET like_count = ...` on B's row is BLOCKED by the
-- posts_update_own RLS policy (author_id = auth.uid()). Result: counts never
-- increment for the normal "like someone else's post" case.
-- SECURITY DEFINER makes the function run as the owner, bypassing RLS.
-- ========================================================================

create or replace function public.tg_likes_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end$$;

create or replace function public.tg_comments_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end$$;

create or replace function public.tg_bookmarks_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set bookmark_count = bookmark_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set bookmark_count = greatest(0, bookmark_count - 1) where id = old.post_id;
  end if;
  return null;
end$$;

create or replace function public.tg_reposts_count() returns trigger
  language plpgsql security definer set search_path = public as $$
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
