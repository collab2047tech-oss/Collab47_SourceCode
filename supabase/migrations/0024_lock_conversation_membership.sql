-- ========================================================================
-- Security: lock down conversation membership inserts.
--
-- The 0009 policy `cm_insert_self` allowed ANY user to INSERT a
-- conversation_members row for themselves into ANY conversation_id
-- (with check user_id = auth.uid()). That let a user join arbitrary
-- conversations via the browser client and read other people's messages.
--
-- All legitimate membership inserts already run through the service-role
-- admin client (getOrCreate1to1Conversation, createGroupConversation), which
-- bypasses RLS. So dropping the user-facing INSERT policy closes the hole
-- without breaking any real flow. Users keep SELECT (self/peer) + UPDATE (self).
-- ========================================================================

drop policy if exists cm_insert_self on public.conversation_members;
