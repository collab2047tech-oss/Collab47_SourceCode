-- 0035_profile_views.sql
-- "Who viewed your profile" + profile-view analytics. One row per (profile,
-- viewer, day) so repeat visits in a day don't inflate counts. Writes go ONLY
-- through record_profile_view() (SECURITY DEFINER, like bump_impressions) which
-- skips self-views; the table is otherwise read-only to the profile OWNER.

create table if not exists public.profile_views (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  viewer_id   uuid not null references public.profiles(id) on delete cascade,
  viewed_on   date not null default current_date,
  viewed_at   timestamptz not null default now()
);

create unique index if not exists profile_views_unique_day on public.profile_views (profile_id, viewer_id, viewed_on);
create index if not exists profile_views_profile_idx on public.profile_views (profile_id, viewed_at desc);

alter table public.profile_views enable row level security;

-- Only the profile OWNER can read who viewed them. No client INSERT/UPDATE: the
-- RPC below is the sole writer (definer), so viewers can't read each other.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_views' and policyname='profile_views_owner_read') then
    create policy profile_views_owner_read on public.profile_views
      for select using (profile_id = auth.uid());
  end if;
end $$;

-- Record a view: dedup per day, skip self + signed-out. SECURITY DEFINER so the
-- viewer (who cannot otherwise write this table) can register the view.
create or replace function public.record_profile_view(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target is null or auth.uid() = target then
    return;
  end if;
  insert into public.profile_views (profile_id, viewer_id, viewed_on, viewed_at)
  values (target, auth.uid(), current_date, now())
  on conflict (profile_id, viewer_id, viewed_on) do update set viewed_at = now();
end;
$$;

grant execute on function public.record_profile_view(uuid) to authenticated;
