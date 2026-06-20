create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_likes enable row level security;
create policy comment_likes_read on public.comment_likes for select using (true);
create policy comment_likes_insert_self on public.comment_likes for insert with check (user_id = auth.uid());
create policy comment_likes_delete_self on public.comment_likes for delete using (user_id = auth.uid());
