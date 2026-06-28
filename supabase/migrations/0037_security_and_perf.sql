-- 0037_security_and_perf.sql
-- Security hardening + hot-path indexes surfaced by audit.

-- ========================================================================
-- 1. CRITICAL: ranker_weights / ranker_model had RLS DISABLED. With RLS off,
--    Supabase's default grants let ANY anon/authenticated user read, overwrite,
--    or activate the production feed model (poison everyone's ranking) or wipe
--    it. Enable RLS with NO policies => default-deny to anon/authenticated. The
--    offline trainer uses the service role, which bypasses RLS, so training is
--    unaffected.
-- ========================================================================
alter table public.ranker_weights enable row level security;
alter table public.ranker_model   enable row level security;

-- ========================================================================
-- 2. HIGH: bump_impressions() let any caller inflate ANY post's impressions in
--    unlimited volume (no auth check, no bound). Require a signed-in caller and
--    cap the batch size so a single call can't sweep the table. (Per-post
--    idempotency is enforced upstream by the viewer's "seen" set; this closes
--    the unauthenticated + unbounded abuse vector.)
-- ========================================================================
create or replace function public.bump_impressions(ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if ids is null or cardinality(ids) = 0 or cardinality(ids) > 50 then return; end if;
  update public.posts set impressions = impressions + 1 where id = any(ids);
end;
$$;

-- ========================================================================
-- 3. PERF: hot-path indexes. The engagement-state read (every feed/profile/post
--    render) and the CF block filter likes/bookmarks by user_id, but the PKs
--    lead with post_id, so the user_id predicate had no usable index. The
--    connections OR-filter (home rail, network, explore, DM permissions) filters
--    user_b_id, also unindexed on that side. These collapse sequential scans to
--    index scans as the tables grow.
-- ========================================================================
create index if not exists likes_user_post_idx       on public.likes (user_id, post_id);
create index if not exists bookmarks_user_post_idx    on public.bookmarks (user_id, post_id);
create index if not exists connections_userb_usera_idx on public.connections (user_b_id, user_a_id);

-- ========================================================================
-- 4. Functional-gap policies (same class as the likes-UPDATE bug): writes that
--    silently RLS-failed. Allow a user to delete a connection they are part of,
--    delete their own message, and edit their own comment.
-- ========================================================================
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='connections' and policyname='connections_delete_party') then
    create policy connections_delete_party on public.connections
      for delete using (auth.uid() = user_a_id or auth.uid() = user_b_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_delete_own') then
    create policy messages_delete_own on public.messages
      for delete using (sender_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='comments_update_own') then
    create policy comments_update_own on public.comments
      for update using (author_id = auth.uid()) with check (author_id = auth.uid());
  end if;
end $$;

-- ========================================================================
-- 5. PERF: an efficient unread-message count. getMessageUnreadCount() runs on
--    EVERY in-app navigation (app shell) and currently transfers every message
--    row in the user's inbox to count in JS. This aggregates server-side: count
--    conversations that have a message newer than the viewer's last_read_at,
--    from someone else, not a request. SECURITY DEFINER so it can read across
--    the viewer's conversations; it only ever counts the CALLER's own unread.
-- ========================================================================
create or replace function public.unread_message_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.conversation_members cm
  where cm.user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.conversation_id = cm.conversation_id
        and m.sender_id <> auth.uid()
        and coalesce(m.is_request, false) = false
        and m.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
    );
$$;

grant execute on function public.unread_message_count() to authenticated;
