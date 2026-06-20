-- ========================================================================
-- Fix: allow news reports.
--
-- The original reports table (0001_init) carried a CHECK that required EXACTLY
-- one of (post_id, profile_id) to be set:
--
--     check ((post_id is not null) <> (profile_id is not null))
--
-- Migration 0014 added a `news_id` column so users could report news stories,
-- but it never relaxed that constraint. A news report sets ONLY news_id, so
-- both post_id and profile_id are null -> (false) <> (false) = false -> the
-- INSERT is rejected. Result: the news Report button always failed silently.
--
-- This migration replaces the 2-way XOR with an exactly-one-of-three check so
-- post, profile, AND news reports are all valid (and a report must still target
-- exactly one thing).
-- ========================================================================

alter table public.reports
  drop constraint if exists reports_check;

-- Some Postgres versions auto-name the anonymous table CHECK differently.
-- Drop any other anonymous check on the same predicate defensively is not
-- possible by predicate, so we rely on the conventional name above; if your
-- environment named it otherwise, drop it manually before re-running.

alter table public.reports
  add constraint reports_one_target_check
  check (
    (
      (case when post_id    is not null then 1 else 0 end) +
      (case when profile_id is not null then 1 else 0 end) +
      (case when news_id     is not null then 1 else 0 end)
    ) = 1
  );

create index if not exists reports_news_id_idx on public.reports (news_id);
