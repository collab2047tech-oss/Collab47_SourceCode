-- Row-Level Security. Default deny everywhere.

alter table public.profiles               enable row level security;
alter table public.posts                  enable row level security;
alter table public.likes                  enable row level security;
alter table public.comments               enable row level security;
alter table public.bookmarks              enable row level security;
alter table public.reports                enable row level security;
alter table public.follows                enable row level security;
alter table public.connections            enable row level security;
alter table public.blocks                 enable row level security;
alter table public.conversations          enable row level security;
alter table public.conversation_members   enable row level security;
alter table public.messages               enable row level security;
alter table public.projects               enable row level security;
alter table public.project_applications   enable row level security;
alter table public.project_members        enable row level security;
alter table public.notifications          enable row level security;
alter table public.news_items             enable row level security;
alter table public.hashtags               enable row level security;
alter table public.post_hashtags          enable row level security;
alter table public.cf_neighbours          enable row level security;
alter table public.ppr_cache              enable row level security;
alter table public.user_seen_posts        enable row level security;
alter table public.user_feed_feedback     enable row level security;

-- profiles
create policy "profiles_read_public"   on public.profiles for select using (true);
create policy "profiles_write_own"     on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_self"   on public.profiles for insert with check (auth.uid() = id);

-- posts
create policy "posts_read_public"      on public.posts for select using (deleted_at is null or true);
create policy "posts_insert_own"       on public.posts for insert with check (auth.uid() = author_id);
create policy "posts_update_own"       on public.posts for update using (auth.uid() = author_id);
create policy "posts_delete_own"       on public.posts for delete using (auth.uid() = author_id);

-- likes
create policy "likes_read_all"         on public.likes for select using (true);
create policy "likes_insert_own"       on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own"       on public.likes for delete using (auth.uid() = user_id);

-- comments
create policy "comments_read_all"      on public.comments for select using (true);
create policy "comments_insert_own"    on public.comments for insert with check (auth.uid() = author_id);
create policy "comments_delete_own"    on public.comments for delete using (auth.uid() = author_id);

-- bookmarks (private to user)
create policy "bookmarks_read_own"     on public.bookmarks for select using (auth.uid() = user_id);
create policy "bookmarks_insert_own"   on public.bookmarks for insert with check (auth.uid() = user_id);
create policy "bookmarks_delete_own"   on public.bookmarks for delete using (auth.uid() = user_id);

-- reports
create policy "reports_insert_own"     on public.reports for insert with check (auth.uid() = reporter_id);
-- reads admin-only via service role

-- follows
create policy "follows_read_all"       on public.follows for select using (true);
create policy "follows_insert_own"     on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own"     on public.follows for delete using (auth.uid() = follower_id);

-- connections
create policy "connections_read_party" on public.connections for select using (
  auth.uid() = user_a_id or auth.uid() = user_b_id
);
create policy "connections_insert_party" on public.connections for insert with check (
  auth.uid() = user_a_id or auth.uid() = user_b_id
);
create policy "connections_update_party" on public.connections for update using (
  auth.uid() = user_a_id or auth.uid() = user_b_id
);

-- blocks
create policy "blocks_read_own"        on public.blocks for select using (auth.uid() = blocker_id);
create policy "blocks_insert_own"      on public.blocks for insert with check (auth.uid() = blocker_id);
create policy "blocks_delete_own"      on public.blocks for delete using (auth.uid() = blocker_id);

-- conversations
create policy "convo_read_member" on public.conversations for select using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = auth.uid())
);
create policy "convo_insert_any" on public.conversations for insert with check (true);

-- conversation_members
create policy "cm_read_self_or_peer" on public.conversation_members for select using (
  user_id = auth.uid() or exists (
    select 1 from public.conversation_members cm2
    where cm2.conversation_id = conversation_members.conversation_id and cm2.user_id = auth.uid()
  )
);
create policy "cm_insert_self" on public.conversation_members for insert with check (
  user_id = auth.uid() or auth.uid() in (
    select user_id from public.conversation_members cm3 where cm3.conversation_id = conversation_members.conversation_id
  )
);
create policy "cm_update_self" on public.conversation_members for update using (user_id = auth.uid());

-- messages: read if member, insert if member AND not blocked
create policy "msg_read_member" on public.messages for select using (
  exists (select 1 from public.conversation_members cm
          where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
);
create policy "msg_insert_member_not_blocked" on public.messages for insert with check (
  auth.uid() = sender_id and
  exists (select 1 from public.conversation_members cm
          where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()) and
  not exists (
    select 1 from public.conversation_members cm2
    join public.blocks b on b.blocked_id = auth.uid() and b.blocker_id = cm2.user_id
    where cm2.conversation_id = messages.conversation_id and cm2.user_id <> auth.uid()
  )
);
create policy "msg_update_read_self" on public.messages for update using (
  exists (select 1 from public.conversation_members cm
          where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
);

-- projects
create policy "proj_read_public"    on public.projects for select using (true);
create policy "proj_insert_own"     on public.projects for insert with check (auth.uid() = author_id);
create policy "proj_update_own"     on public.projects for update using (auth.uid() = author_id);
create policy "proj_delete_own"     on public.projects for delete using (auth.uid() = author_id);

-- project_applications: applicant + project author can read
create policy "app_read_party" on public.project_applications for select using (
  auth.uid() = applicant_id or
  exists (select 1 from public.projects p where p.id = project_applications.project_id and p.author_id = auth.uid())
);
create policy "app_insert_self" on public.project_applications for insert with check (auth.uid() = applicant_id);
create policy "app_update_author" on public.project_applications for update using (
  exists (select 1 from public.projects p where p.id = project_applications.project_id and p.author_id = auth.uid())
);

-- project_members
create policy "pm_read_public" on public.project_members for select using (true);
create policy "pm_insert_author" on public.project_members for insert with check (
  exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid())
);
create policy "pm_delete_author" on public.project_members for delete using (
  exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid())
);

-- notifications: read own only
create policy "notif_read_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_update_own" on public.notifications for update using (auth.uid() = user_id);
-- inserts: server-only (service role bypasses RLS)

-- news_items: read all, writes server-only
create policy "news_read_all" on public.news_items for select using (true);

-- hashtags + post_hashtags: read all, post-side writes by post owner
create policy "hashtags_read" on public.hashtags for select using (true);
create policy "ph_read" on public.post_hashtags for select using (true);
create policy "ph_insert_post_owner" on public.post_hashtags for insert with check (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);

-- cf_neighbours, ppr_cache: read public, write service-only
create policy "cf_read" on public.cf_neighbours for select using (true);
create policy "ppr_read" on public.ppr_cache for select using (true);

-- user_seen_posts: own only
create policy "seen_read_own" on public.user_seen_posts for select using (auth.uid() = user_id);
create policy "seen_insert_own" on public.user_seen_posts for insert with check (auth.uid() = user_id);

-- user_feed_feedback: own only
create policy "feedback_read_own" on public.user_feed_feedback for select using (auth.uid() = user_id);
create policy "feedback_insert_own" on public.user_feed_feedback for insert with check (auth.uid() = user_id);
