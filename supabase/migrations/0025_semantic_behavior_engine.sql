-- ========================================================================
-- Feed engine upgrade: zero-cost semantic + behavioural signals.
--   - pg_trgm: typo-tolerant fuzzy matching (trigram GIN indexes).
--   - feed_events: real behavioural-signal capture (impression/dwell/click/
--     expand/save/skip) - the fuel for engagement-rate, dedup, and learning.
--   - bump_impressions(): SECURITY DEFINER so a viewer (not the author) can
--     increment a post's impression counter.
--   - ranker_weights: store for weights LEARNED from behaviour (nightly fit).
-- Applied live via the Management API; this file is the repo record.
-- ========================================================================

create extension if not exists pg_trgm;

create table if not exists public.feed_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  kind       text not null check (kind in ('impression','dwell','click','expand','profile_click','save','skip','hide')),
  value      numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.feed_events enable row level security;
drop policy if exists feed_events_insert_self on public.feed_events;
create policy feed_events_insert_self on public.feed_events for insert with check (user_id = auth.uid());
drop policy if exists feed_events_read_self on public.feed_events;
create policy feed_events_read_self on public.feed_events for select using (user_id = auth.uid());
create index if not exists feed_events_user_created_idx on public.feed_events (user_id, created_at desc);
create index if not exists feed_events_user_post_kind_idx on public.feed_events (user_id, post_id, kind);

create or replace function public.bump_impressions(ids uuid[])
returns void language sql security definer set search_path = public as $fn$
  update public.posts set impressions = impressions + 1 where id = any(ids);
$fn$;

create index if not exists posts_body_trgm_idx on public.posts using gin (body gin_trgm_ops);
create index if not exists profiles_name_trgm_idx on public.profiles using gin (name gin_trgm_ops);

create table if not exists public.ranker_weights (
  id         int primary key default 1,
  weights    jsonb not null default '{}'::jsonb,
  fitted_at  timestamptz,
  n_samples  int default 0
);
insert into public.ranker_weights (id) values (1) on conflict do nothing;
