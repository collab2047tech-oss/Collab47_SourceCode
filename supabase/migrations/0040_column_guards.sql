-- 0040_column_guards.sql
-- CRITICAL mass-assignment fix. RLS WITH CHECK (id = auth.uid() / author_id =
-- auth.uid()) restricts WHICH ROW a user may update, NOT which columns. So a
-- user could:
--   - profiles: set verified=true (fake badge) or suspended_at=null (evade ban)
--   - posts: overwrite like_count/comment_count/repost_count/bookmark_count/
--     impressions on their own posts (fabricate engagement, game the ranker)

-- ---- profiles: revert privileged columns on any end-user UPDATE -------------
-- A trigger (not column grants) because profiles has many user-editable columns
-- and only TWO privileged ones; nothing legitimately sets verified/suspended_at
-- as a user, so reverting them to OLD never breaks a real edit. Service role
-- (auth.uid() null) and moderation/verification flows are unaffected.
create or replace function public.guard_profiles_privileged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.verified     := old.verified;
    new.suspended_at := old.suspended_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_privileged on public.profiles;
create trigger trg_guard_profiles_privileged
  before update on public.profiles
  for each row execute function public.guard_profiles_privileged();

-- ---- posts: column-level UPDATE grants -------------------------------------
-- A trigger would fight the SECURITY DEFINER counter triggers (which run with a
-- real auth.uid() during a like/comment and legitimately bump the counters).
-- Column grants are the right tool: the authenticated role may UPDATE only the
-- columns a user actually controls; the counter triggers run as the table owner
-- and bypass these grants, so counts still update.
revoke update on public.posts from authenticated;
grant  update (is_pinned, is_highlight, expires_at, deleted_at) on public.posts to authenticated;
