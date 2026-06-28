-- ========================================================================
-- 0030_account_settings.sql
-- Phase 7: account change limits + private-profile RLS (defense in depth).
--
-- This is the REAL privacy fix. Until now `posts_read_public` allowed any
-- non-deleted post to be read by anyone (0009_security_hardening.sql:8-9), so a
-- "private" profile's posts were fully fetchable through the Supabase API
-- regardless of the /u/[handle] UI block. This migration gates a PRIVATE
-- author's posts at the row level: only the author or an accepted connection of
-- the author may read them. Public authors are completely unchanged, so the
-- home feed, explore, and every public profile keep working exactly as before.
-- ========================================================================

-- ------------------------------------------------------------------------
-- (a) 7-day change-limit tracking for full name + handle.
--     (Idempotent: these columns may already exist from an earlier step.)
-- ------------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_name_change_at   timestamptz,
  add column if not exists last_handle_change_at timestamptz;

-- ------------------------------------------------------------------------
-- (b) First-class privacy flag.
--     `privacy.public_profile = false` is the de-facto "private" flag today.
--     A typed boolean column lets RLS reference it cleanly (no jsonb parsing
--     inside a hot policy) and lets the ranker index it later. It is kept in
--     sync with privacy.public_profile by updatePrivacy() in lib/db/profiles.ts
--     (both are written in one update); is_private is the source of truth.
-- ------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_private boolean not null default false;

-- Backfill from the existing jsonb so no one's current privacy state is lost.
update public.profiles
  set is_private = ((privacy->>'public_profile') = 'false')
  where privacy ? 'public_profile'
    and is_private is distinct from ((privacy->>'public_profile') = 'false');

-- ------------------------------------------------------------------------
-- Helper: is `viewer` an accepted connection of `target`?
-- SECURITY DEFINER so the policy is not blinded by connections' own RLS
-- (connections_read_party only lets a party read their own rows; a posts
-- policy evaluated as the VIEWER could never see the author's connection row
-- without this). Same precedent as the conversation-membership helpers.
-- STABLE + a pinned search_path are required for a safe SECURITY DEFINER fn.
-- The connections table stores a canonical pair (user_a_id < user_b_id), so we
-- normalise the (viewer, target) pair with least()/greatest() before matching.
-- ------------------------------------------------------------------------
create or replace function public.is_connected(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and c.user_a_id = least(viewer, target)
      and c.user_b_id = greatest(viewer, target)
  );
$$;

-- Lock the function down: callable by app roles, but never abusable to probe
-- arbitrary pairs beyond a true/false (it only ever returns a boolean).
revoke all on function public.is_connected(uuid, uuid) from public;
grant execute on function public.is_connected(uuid, uuid) to anon, authenticated;

-- ------------------------------------------------------------------------
-- (b) Defense-in-depth RLS on posts.
--     A PRIVATE author's posts are readable only by the author or one of their
--     accepted connections. PUBLIC authors are unaffected: the `not exists
--     (... is_private)` branch short-circuits to TRUE for them, so the policy
--     is identical to the old `deleted_at is null` rule for public authors.
--     The owner always sees their own posts (author_id = auth.uid()).
-- ------------------------------------------------------------------------
drop policy if exists "posts_read_public" on public.posts;
create policy "posts_read_public" on public.posts
  for select using (
    deleted_at is null
    and (
      -- public author (or author row missing): unchanged, world-readable.
      not exists (
        select 1 from public.profiles pr
        where pr.id = posts.author_id and pr.is_private = true
      )
      -- private author: only the owner or an accepted connection.
      or posts.author_id = auth.uid()
      or public.is_connected(auth.uid(), posts.author_id)
    )
  );

-- Note for the feed area: lib/db/feed.ts and the search RPCs read posts through
-- this same policy. Public authors are unchanged, so the home feed does NOT
-- regress. A private author's posts will now correctly drop out of a stranger's
-- feed / search results, which is the intended behavior.
