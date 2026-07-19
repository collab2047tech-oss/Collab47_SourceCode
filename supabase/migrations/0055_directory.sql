-- 0055_directory.sql
-- Public reference directories: Indian higher-education INSTITUTIONS and
-- DPIIT-recognized STARTUPS. One flat table, discriminated by `kind`, feeding the
-- onboarding pickers (institution search) and future startup search.
--
-- Data lifecycle:
--   * Seeded from a curated BOOTSTRAP (real institutions + real DPIIT startups) so
--     the pickers work day one, before any government API key exists.
--   * Refreshed nightly by /api/cron/directory, which UPSERTs from data.gov.in
--     (AISHE institutions, DPIIT startups) once DATA_GOV_IN_API_KEY is set.
--   * Sync is UPSERT-only and never truncates: a source going dark or a partial
--     fetch failure can only ADD/refresh rows, never wipe the directory.
--
-- Writes are service-role only (cron/seed use the service key, which bypasses
-- RLS). No INSERT/UPDATE/DELETE policy exists, so anon + authenticated are denied
-- writes by default. SELECT is public: this is non-sensitive reference data.

create extension if not exists pg_trgm;   -- fuzzy name search (already present from 0025/0027)
create extension if not exists pgcrypto;  -- gen_random_uuid() (already present from 0001)

create table if not exists public.directory_entries (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('institution', 'startup')),
  name       text not null,
  city       text,
  state      text,
  extra      jsonb not null default '{}'::jsonb,
  source     text not null,
  source_ref text,
  updated_at timestamptz not null default now(),
  unique (kind, name)
);

-- Trigram GIN index for typo-tolerant / substring name search (ILIKE + similarity()).
create index if not exists directory_entries_name_trgm_idx
  on public.directory_entries using gin (name gin_trgm_ops);

-- Filter-by-kind is on the hot path of every search query.
create index if not exists directory_entries_kind_idx
  on public.directory_entries (kind);

alter table public.directory_entries enable row level security;

-- Public read: reference data, safe for anon + authenticated. No write policy is
-- defined, so all writes fall through to "denied" for non-service-role callers.
drop policy if exists directory_entries_read_all on public.directory_entries;
create policy directory_entries_read_all on public.directory_entries
  for select using (true);

-- Explicit grants so PostgREST exposes SELECT to the anon/authenticated roles.
grant select on public.directory_entries to anon, authenticated;
