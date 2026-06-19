-- ========================================================================
-- News engagement: reactions, comments, counter columns, and news reporting
-- ========================================================================

-- 1. Add engagement count columns to news_items ---------------------------
alter table public.news_items
  add column if not exists like_count    int not null default 0,
  add column if not exists dislike_count int not null default 0,
  add column if not exists comment_count int not null default 0;

-- 2. news_reactions -------------------------------------------------------
create table if not exists public.news_reactions (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  news_id    uuid not null references public.news_items(id) on delete cascade,
  kind       text not null check (kind in ('like','dislike')),
  created_at timestamptz not null default now(),
  primary key (user_id, news_id)
);

-- RLS for news_reactions
alter table public.news_reactions enable row level security;

create policy "news_reactions_read_all" on public.news_reactions
  for select using (true);

create policy "news_reactions_insert_own" on public.news_reactions
  for insert with check (auth.uid() = user_id);

create policy "news_reactions_update_own" on public.news_reactions
  for update using (auth.uid() = user_id);

create policy "news_reactions_delete_own" on public.news_reactions
  for delete using (auth.uid() = user_id);

-- 3. news_comments --------------------------------------------------------
create table if not exists public.news_comments (
  id         uuid        not null default gen_random_uuid() primary key,
  news_id    uuid        not null references public.news_items(id) on delete cascade,
  author_id  uuid        not null references public.profiles(id) on delete cascade,
  body       text        not null check (char_length(body) <= 600),
  created_at timestamptz not null default now()
);

-- RLS for news_comments
alter table public.news_comments enable row level security;

create policy "news_comments_read_all" on public.news_comments
  for select using (true);

create policy "news_comments_insert_own" on public.news_comments
  for insert with check (auth.uid() = author_id);

create policy "news_comments_delete_own" on public.news_comments
  for delete using (auth.uid() = author_id);

-- 4. Add news_id to reports table -----------------------------------------
alter table public.reports
  add column if not exists news_id uuid references public.news_items(id) on delete set null;

-- 5. Counter triggers (SECURITY DEFINER, mirrors 0012 pattern) -----------

-- 5a. news_reactions -> news_items like_count / dislike_count
create or replace function public.tg_news_reactions_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    if new.kind = 'like' then
      update public.news_items set like_count = like_count + 1 where id = new.news_id;
    elsif new.kind = 'dislike' then
      update public.news_items set dislike_count = dislike_count + 1 where id = new.news_id;
    end if;
  elsif (tg_op = 'DELETE') then
    if old.kind = 'like' then
      update public.news_items set like_count = greatest(0, like_count - 1) where id = old.news_id;
    elsif old.kind = 'dislike' then
      update public.news_items set dislike_count = greatest(0, dislike_count - 1) where id = old.news_id;
    end if;
  elsif (tg_op = 'UPDATE') then
    -- kind changed (like <-> dislike): decrement old, increment new
    if old.kind = 'like' then
      update public.news_items set like_count = greatest(0, like_count - 1) where id = old.news_id;
    elsif old.kind = 'dislike' then
      update public.news_items set dislike_count = greatest(0, dislike_count - 1) where id = old.news_id;
    end if;
    if new.kind = 'like' then
      update public.news_items set like_count = like_count + 1 where id = new.news_id;
    elsif new.kind = 'dislike' then
      update public.news_items set dislike_count = dislike_count + 1 where id = new.news_id;
    end if;
  end if;
  return null;
end$$;

drop trigger if exists news_reactions_count_trg on public.news_reactions;
create trigger news_reactions_count_trg
  after insert or update or delete on public.news_reactions
  for each row execute function public.tg_news_reactions_count();

-- 5b. news_comments -> news_items comment_count
create or replace function public.tg_news_comments_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.news_items set comment_count = comment_count + 1 where id = new.news_id;
  elsif (tg_op = 'DELETE') then
    update public.news_items set comment_count = greatest(0, comment_count - 1) where id = old.news_id;
  end if;
  return null;
end$$;

drop trigger if exists news_comments_count_trg on public.news_comments;
create trigger news_comments_count_trg
  after insert or delete on public.news_comments
  for each row execute function public.tg_news_comments_count();

-- 6. Backfill existing rows (all zero since tables are new, but defensive)
update public.news_items ni set
  like_count    = (select count(*) from public.news_reactions r where r.news_id = ni.id and r.kind = 'like'),
  dislike_count = (select count(*) from public.news_reactions r where r.news_id = ni.id and r.kind = 'dislike'),
  comment_count = (select count(*) from public.news_comments  c where c.news_id = ni.id);
