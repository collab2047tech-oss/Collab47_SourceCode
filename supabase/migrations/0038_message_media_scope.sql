-- 0038_message_media_scope.sql
-- Scope the message-media bucket to conversation membership. Upload paths are
-- `<conversation_id>/<file>` (MessageComposer), so the first path segment is the
-- conversation id. Previously ANY authenticated user could read/write EVERY DM
-- attachment. Now only members of the conversation can read/write its folder.
--
-- NOTE: the bucket is public + paths carry a random component, so public-CDN
-- access by exact URL is still possible; the complete fix is a PRIVATE bucket +
-- signed URLs (follow-up). This closes the cross-conversation write/poison vector
-- and the authenticated storage-API read vector now.

drop policy if exists stor_read_message_media on storage.objects;
create policy stor_read_message_media on storage.objects
  for select using (
    bucket_id = 'message-media'
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = ((storage.foldername(name))[1])::uuid
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists stor_write_message_media on storage.objects;
create policy stor_write_message_media on storage.objects
  for insert with check (
    bucket_id = 'message-media'
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = ((storage.foldername(name))[1])::uuid
        and cm.user_id = auth.uid()
    )
  );
