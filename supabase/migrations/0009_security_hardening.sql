-- ========================================================================
-- Security hardening (from production audit).
-- ========================================================================

-- 1. Soft-deleted posts must NOT be readable. The old policy had `or true`,
--    which leaked every deleted post to any authenticated user.
drop policy if exists "posts_read_public" on public.posts;
create policy "posts_read_public" on public.posts
  for select using (deleted_at is null);

-- 2. Allow up to 5 images per post (matches product spec; was capped at 4).
alter table public.posts drop constraint if exists posts_image_urls_check;
alter table public.posts add constraint posts_image_urls_check
  check (cardinality(image_urls) <= 5);

-- 3. Conversation + membership creation is now done server-side via the
--    service role. Users may no longer self-insert conversations or add other
--    people to a conversation (closes a DM-spam / forced-add vector).
drop policy if exists "convo_insert_any" on public.conversations;

drop policy if exists "cm_insert_self" on public.conversation_members;
create policy "cm_insert_self" on public.conversation_members
  for insert with check (user_id = auth.uid());

-- 4. Messages may only be UPDATED by their sender (was: any conversation
--    member could edit anyone's message body). Request-accept + read state are
--    handled server-side / on conversation_members.
drop policy if exists "msg_update_read_self" on public.messages;
create policy "msg_update_own" on public.messages
  for update using (sender_id = auth.uid());

-- 5. The moderation_queue view exposed reporter identities + reported content.
--    Lock it to the service role only (the admin dashboard uses service role).
revoke all on public.moderation_queue from anon, authenticated;
