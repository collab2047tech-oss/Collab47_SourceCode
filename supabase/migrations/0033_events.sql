-- ========================================================================
-- 0033_events.sql
-- Events surface: anyone (companies, colleges, students) can POST and BROWSE
-- upcoming hackathons, competitions, workshops, conferences, fests, talks, and
-- college events. Mirrors the public.projects model (author-owned rows, soft
-- delete via deleted_at, world-readable while live).
--
-- Fully idempotent: safe to re-run. Table is created only if missing; every
-- policy is guarded with the do-$$ if-not-exists-in-pg_policies pattern used in
-- 0030_account_settings.sql so re-applying never errors on a duplicate policy.
-- ========================================================================

create table if not exists public.events (
  id                    uuid primary key default gen_random_uuid(),
  author_id             uuid not null references public.profiles(id) on delete cascade,
  title                 text not null,
  description           text,
  kind                  text not null check (kind in ('hackathon','competition','workshop','conference','fest','talk','other')),
  organizer             text,
  mode                  text not null default 'online' check (mode in ('online','in_person','hybrid')),
  location              text,
  starts_at             timestamptz,
  ends_at               timestamptz,
  registration_deadline timestamptz,
  registration_url      text,
  prize                 text,
  tags                  text[] not null default '{}',
  image_url             text,
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

-- Discovery indexes: list-by-soonest (upcoming) and the live-only listing path
-- both order/filter on these. The partial-ish composite mirrors the typical
-- "live events, soonest first" query.
create index if not exists events_starts_at_idx          on public.events (starts_at);
create index if not exists events_deleted_starts_at_idx  on public.events (deleted_at, starts_at);

-- ------------------------------------------------------------------------
-- RLS: world-readable while live; author-owned writes.
-- ------------------------------------------------------------------------
alter table public.events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'events_read_all'
  ) then
    create policy "events_read_all" on public.events
      for select using (deleted_at is null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'events_insert_own'
  ) then
    create policy "events_insert_own" on public.events
      for insert with check (author_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'events_update_own'
  ) then
    create policy "events_update_own" on public.events
      for update using (author_id = auth.uid()) with check (author_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'events_delete_own'
  ) then
    create policy "events_delete_own" on public.events
      for delete using (author_id = auth.uid());
  end if;
end$$;
