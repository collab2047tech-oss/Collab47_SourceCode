-- ========================================================================
-- Storage RLS policies
-- Buckets: avatars, covers, post-media (public read) + message-media (private)
-- Upload path convention:
--   avatars/covers/post-media : <auth.uid()>/<file>   (owner-scoped)
--   message-media             : <conversation_id>/<file>  (any authed member)
-- ========================================================================

-- Public read for the three public buckets (also served via CDN public URLs).
create policy "stor_read_avatars"    on storage.objects for select using (bucket_id = 'avatars');
create policy "stor_read_covers"     on storage.objects for select using (bucket_id = 'covers');
create policy "stor_read_post_media" on storage.objects for select using (bucket_id = 'post-media');

-- Owner-scoped write (first path segment must equal the user id).
create policy "stor_write_avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stor_update_avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stor_delete_avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "stor_write_covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stor_update_covers" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stor_delete_covers" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "stor_write_post_media" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stor_delete_post_media" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- message-media: private. Any authenticated user may upload + read (member checks
-- enforced at the messages-table layer; tighten to conversation membership later).
create policy "stor_read_message_media" on storage.objects for select to authenticated
  using (bucket_id = 'message-media');
create policy "stor_write_message_media" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-media');
