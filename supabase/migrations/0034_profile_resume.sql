-- 0034_profile_resume.sql
-- Structured professional profile (LinkedIn-style "resume"): Experience,
-- Education, Skills. Owner-writable; readable subject to the SAME profile-privacy
-- rule as posts (public author OR owner OR a connection), so a private profile's
-- resume is gated exactly like its posts. is_connected() comes from 0030.

create table if not exists public.profile_experience (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'work' check (type in ('work','internship','project','research','volunteer','leadership')),
  title       text not null,
  organization text,
  location    text,
  start_date  date,
  end_date    date,
  is_current  boolean not null default false,
  description text,
  skills      text[] not null default '{}',
  url         text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.profile_education (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  institution   text not null,
  degree        text,
  field_of_study text,
  start_date    date,
  end_date      date,
  is_current    boolean not null default false,
  grade         text,
  description   text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.profile_skills (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  category   text not null default 'technical' check (category in ('technical','soft','tool','language')),
  created_at timestamptz not null default now()
);

create index if not exists profile_experience_user_idx on public.profile_experience (user_id, sort_order, start_date desc);
create index if not exists profile_education_user_idx  on public.profile_education (user_id, sort_order, start_date desc);
create index if not exists profile_skills_user_idx     on public.profile_skills (user_id);
-- One skill name per user (case-insensitive).
create unique index if not exists profile_skills_user_name_idx on public.profile_skills (user_id, lower(name));

alter table public.profile_experience enable row level security;
alter table public.profile_education  enable row level security;
alter table public.profile_skills     enable row level security;

-- Shared privacy predicate: viewer may read a profile's resume iff the profile
-- is public, or it is their own, or they are connected to the owner.
do $$
declare
  t text;
  read_pred text := '(exists (select 1 from public.profiles pr where pr.id = %I.user_id and (pr.is_private is not true or pr.id = auth.uid() or public.is_connected(auth.uid(), pr.id))))';
begin
  foreach t in array array['profile_experience','profile_education','profile_skills'] loop
    -- read (privacy-gated)
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_read') then
      execute format('create policy %I on public.%I for select using '||read_pred, t||'_read', t, t);
    end if;
    -- insert own
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_insert_own') then
      execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t||'_insert_own', t);
    end if;
    -- update own
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_update_own') then
      execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t||'_update_own', t);
    end if;
    -- delete own
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_delete_own') then
      execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t||'_delete_own', t);
    end if;
  end loop;
end $$;
