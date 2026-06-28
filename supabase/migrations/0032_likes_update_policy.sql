-- 0032_likes_update_policy.sql
-- BUG FIX: the likes table had SELECT/INSERT/DELETE policies but NO UPDATE
-- policy. reactToPost() upserts on (post_id, user_id) to CHANGE an existing
-- reaction (e.g. like -> love, or re-picking the same reaction). That
-- on-conflict UPDATE was denied by RLS ("new row violates row-level security
-- policy"), so changing a reaction silently failed and the optimistic UI
-- reverted - perceived as "likes/reactions not updating".
--
-- Allow a user to update ONLY their own reaction row.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'likes' and policyname = 'likes_update_own'
  ) then
    create policy likes_update_own on public.likes
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
