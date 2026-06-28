-- ========================================================================
-- News quality + personalisation (Phase 4)
--
-- 1. Honest summary fields on news_items (a real summary distinct from the
--    raw publisher blurb) + reader-facing topics + language.
-- 2. A durable per-user news topic affinity (bridges the localStorage loop to
--    the real cross-device engine).
-- 3. A lightweight reading-behaviour log for news (mirrors feed_events).
-- 4. A real Save / bookmark table for news (replaces up/down votes as the keep
--    signal).
-- ========================================================================

-- 1. Summary fields ------------------------------------------------------
alter table public.news_items
  add column if not exists summary        text,
  add column if not exists summary_status text not null default 'none'
    check (summary_status in ('ai','headline','raw','none')),
  add column if not exists topics         text[] not null default '{}', -- reader-facing: Tech/Business/Careers/...
  add column if not exists lang           text not null default 'en';

-- Backfill: treat any existing excerpt as the summary (status 'raw') so the UI
-- never regresses to an empty card while the backfill job upgrades the tail.
update public.news_items
  set summary = excerpt,
      summary_status = case when excerpt is null or btrim(excerpt) = '' then 'none' else 'raw' end
  where summary is null;

create index if not exists news_items_topics_gin on public.news_items using gin (topics);

-- 2. Durable per-user news topic affinity --------------------------------
create table if not exists public.news_topic_affinity (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  topic      text not null,
  weight     real not null default 0,          -- decayed reinforcement
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);
alter table public.news_topic_affinity enable row level security;
create policy "nta_read_own"   on public.news_topic_affinity for select using (auth.uid() = user_id);
create policy "nta_insert_own" on public.news_topic_affinity for insert with check (auth.uid() = user_id);
create policy "nta_update_own" on public.news_topic_affinity for update using (auth.uid() = user_id);

-- 3. Reading-behaviour log for news --------------------------------------
create table if not exists public.news_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  news_id    uuid not null references public.news_items(id) on delete cascade,
  kind       text not null check (kind in ('impression','open','save','more','less','share')),
  created_at timestamptz not null default now()
);
alter table public.news_events enable row level security;
create policy "news_events_insert_own" on public.news_events for insert with check (auth.uid() = user_id);
create policy "news_events_read_own"   on public.news_events for select using (auth.uid() = user_id);
create index if not exists news_events_user_created on public.news_events (user_id, created_at desc);

-- 4. Save / bookmark a news item -----------------------------------------
create table if not exists public.news_saves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  news_id    uuid not null references public.news_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, news_id)
);
alter table public.news_saves enable row level security;
create policy "news_saves_read_own"   on public.news_saves for select using (auth.uid() = user_id);
create policy "news_saves_insert_own" on public.news_saves for insert with check (auth.uid() = user_id);
create policy "news_saves_delete_own" on public.news_saves for delete using (auth.uid() = user_id);
create index if not exists news_saves_user_created on public.news_saves (user_id, created_at desc);
