-- 0053_handle_canonical_unique.sql
-- Confusable-username defense (impersonation).
--
-- Two handles that differ ONLY by underscores - "shorya_noodle" vs
-- "shoryanoodle" - read as the same person and are a cheap way to impersonate
-- someone. We treat the UNDERSCORE-STRIPPED form as the true identity key:
--   canon(h) = replace(h, '_', '')
-- A unique index on that expression makes the DATABASE the final arbiter: the
-- race loser gets a 23505 (mapped to a friendly message in the app instead of a
-- raw Postgres error), and a helper function lets the app pre-check a candidate
-- before insert / live while the user is still typing their username.
--
-- Verified safe to apply: profiles currently carries an EXACT-unique index on
-- handle only, and production has ZERO existing canonical collisions, so this
-- index builds cleanly with no conflicts.

create unique index if not exists profiles_handle_canonical_key
  on public.profiles ((replace(handle, '_', '')));

comment on index public.profiles_handle_canonical_key is
  'Canonical (underscore-stripped) handle uniqueness. Blocks confusable-username impersonation such as shorya_noodle vs shoryanoodle.';

-- Does any OTHER profile already own the canonical form of `candidate`?
-- SECURITY DEFINER so an ordinary authenticated caller can test a handle they do
-- not yet own; STABLE because it only reads. The caller's OWN row is excluded
-- (via auth.uid()) so a re-onboard that keeps the same handle is never reported
-- as a collision. When invoked with the service role (auth.uid() is null, e.g.
-- the /api/handle-available endpoint) it considers every row.
create or replace function public.handle_canonical_taken(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where replace(p.handle, '_', '') = replace(lower(candidate), '_', '')
      and (auth.uid() is null or p.id <> auth.uid())
  );
$$;

grant execute on function public.handle_canonical_taken(text) to authenticated, anon, service_role;
