-- Collab47 v1 schema. Runs on Supabase Pro.
-- Enable required extensions.
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ========================================================================
-- profiles : extends auth.users 1:1
-- ========================================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  handle          text unique not null check (handle ~ '^[a-z0-9_]{3,32}$'),
  name            text not null,
  bio             text,
  avatar_url      text,
  cover_url       text,
  college         text,
  branch          text,
  year_of_study   text,
  city            text,
  interests       text[] not null default '{}',
  cluster_id      int,
  verified        boolean not null default false,
  suspended_at    timestamptz,
  deleted_at      timestamptz,
  dm_permission   text not null default 'everyone'
                  check (dm_permission in ('everyone','connections','nobody')),
  onboarded       boolean not null default false,
  search_tsv      tsvector,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.profiles using gin (search_tsv);
create index on public.profiles (handle);
create index on public.profiles (college);
create index on public.profiles (cluster_id);

-- Trigger: maintain search_tsv + updated_at
create or replace function public.tg_profile_updated() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.search_tsv := to_tsvector('simple',
    coalesce(new.handle,'')||' '||coalesce(new.name,'')||' '||coalesce(new.bio,'')||' '||coalesce(new.college,''));
  return new;
end$$;
create trigger profile_before_upsert before insert or update on public.profiles
  for each row execute function public.tg_profile_updated();

-- ========================================================================
-- posts
-- ========================================================================
create table public.posts (
  id                   uuid primary key default gen_random_uuid(),
  short_id             text unique not null default substring(encode(gen_random_bytes(6),'base64') from 1 for 8),
  author_id            uuid not null references public.profiles(id) on delete cascade,
  body                 text not null check (char_length(body) <= 2000),
  image_urls           text[] not null default '{}' check (cardinality(image_urls) <= 4),
  video_url            text,
  hashtags             text[] not null default '{}',
  branch_tags          text[] not null default '{}',
  city_tags            text[] not null default '{}',
  is_pinned            boolean not null default false,
  is_repost            boolean not null default false,
  reposted_from_post_id uuid references public.posts(id) on delete set null,
  is_highlight         boolean not null default false,
  expires_at           timestamptz,
  like_count           int not null default 0,
  comment_count        int not null default 0,
  repost_count         int not null default 0,
  bookmark_count       int not null default 0,
  search_tsv           tsvector,
  content_vector       vector(384),
  deleted_at           timestamptz,
  created_at           timestamptz not null default now()
);
create index on public.posts (author_id, created_at desc);
create index on public.posts (created_at desc);
create index on public.posts using gin (hashtags);
create index on public.posts using gin (branch_tags);
create index on public.posts using gin (city_tags);
create index on public.posts using gin (search_tsv);
create index on public.posts using ivfflat (content_vector vector_cosine_ops);
create index on public.posts (expires_at) where expires_at is not null;

create or replace function public.tg_post_search_tsv() returns trigger language plpgsql as $$
begin
  new.search_tsv := to_tsvector('simple',
    coalesce(new.body,'')||' '||coalesce(array_to_string(new.hashtags,' '),''));
  return new;
end$$;
create trigger post_before_upsert before insert or update on public.posts
  for each row execute function public.tg_post_search_tsv();

-- ========================================================================
-- engagement: likes, comments, reposts, bookmarks, reports
-- ========================================================================
create table public.likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  author_id         uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body              text not null check (char_length(body) <= 600),
  created_at        timestamptz not null default now()
);
create index on public.comments (post_id, created_at);

create table public.bookmarks (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id     uuid references public.posts(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete cascade,
  category    text not null check (category in ('spam','hate','sexual','other')),
  body        text,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  check ((post_id is not null) <> (profile_id is not null))
);
create index on public.reports (post_id);
create index on public.reports (profile_id);

-- ========================================================================
-- graph: follows, connections, blocks
-- ========================================================================
create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index on public.follows (following_id);

create table public.connections (
  user_a_id   uuid not null references public.profiles(id) on delete cascade,
  user_b_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted')),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  check (user_a_id < user_b_id)  -- canonical ordering
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ========================================================================
-- messaging
-- ========================================================================
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  type            text not null default 'one_to_one' check (type in ('one_to_one','group')),
  project_id      uuid,  -- FK added below after projects table
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  muted           boolean not null default false,
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);
create index on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) <= 4000),
  image_url       text,
  is_request      boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);

-- ========================================================================
-- collab projects
-- ========================================================================
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  short_id     text unique not null default substring(encode(gen_random_bytes(6),'base64') from 1 for 8),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  brief        text not null,
  deliverable  text not null,
  deadline     date not null,
  slot_count   int not null check (slot_count between 1 and 8),
  status       text not null default 'open' check (status in ('open','team_formed','in_progress','delivered','closed')),
  search_tsv   tsvector,
  created_at   timestamptz not null default now()
);
create index on public.projects (status);
create index on public.projects (deadline);
create index on public.projects using gin (search_tsv);

alter table public.conversations
  add constraint conversations_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;

create table public.project_applications (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  pitch        text not null check (char_length(pitch) <= 800),
  links        text[] not null default '{}' check (cardinality(links) <= 3),
  status       text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at   timestamptz not null default now(),
  unique (project_id, applicant_id)
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- ========================================================================
-- notifications + news + hashtags
-- ========================================================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.news_items (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  url         text unique not null,
  title       text not null,
  excerpt     text,
  image_url   text,
  branch_tags text[] not null default '{}',
  city_tags   text[] not null default '{}',
  published_at timestamptz not null,
  fetched_at   timestamptz not null default now()
);
create index on public.news_items (published_at desc);
create index on public.news_items using gin (branch_tags);

create table public.hashtags (
  tag        text primary key,
  use_count  int not null default 0,
  created_at timestamptz not null default now()
);

create table public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag     text not null references public.hashtags(tag) on delete cascade,
  primary key (post_id, tag)
);

-- ========================================================================
-- ranker caches (service role writes only)
-- ========================================================================
create table public.cf_neighbours (
  post_id     uuid primary key references public.posts(id) on delete cascade,
  neighbours  jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

create table public.ppr_cache (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  top_posts  jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table public.user_seen_posts (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  post_id  uuid not null references public.posts(id) on delete cascade,
  seen_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index on public.user_seen_posts (seen_at);

create table public.user_feed_feedback (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  post_id   uuid not null references public.posts(id) on delete cascade,
  signal    text not null check (signal in ('not_interested','tag_downvote')),
  meta      jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, post_id, signal)
);

-- ========================================================================
-- engagement count maintenance triggers
-- ========================================================================
create or replace function public.tg_like_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end$$;
create trigger likes_count_t after insert or delete on public.likes for each row execute function public.tg_like_count();

create or replace function public.tg_comment_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end$$;
create trigger comments_count_t after insert or delete on public.comments for each row execute function public.tg_comment_count();

create or replace function public.tg_bookmark_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set bookmark_count = bookmark_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set bookmark_count = greatest(bookmark_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end$$;
create trigger bookmarks_count_t after insert or delete on public.bookmarks for each row execute function public.tg_bookmark_count();
