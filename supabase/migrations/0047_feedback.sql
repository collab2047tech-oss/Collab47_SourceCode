-- 0047_feedback.sql
-- In-app feedback / bug reports / feature requests. Users submit; the founder
-- reads everything via the admin queue. Captures the page + user agent so a bug
-- is reproducible.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  kind        text not null default 'bug' check (kind in ('bug','feature','other')),
  subject     text not null,
  body        text not null,
  page_url    text,
  user_agent  text,
  status      text not null default 'open' check (status in ('open','in_progress','resolved','wont_fix')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

-- A signed-in user may submit feedback as themselves, and read back ONLY their
-- own submissions (to see status). Admins read/triage everything via the
-- service-role client (no client-side admin policy = no leakage).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feedback' and policyname='feedback_insert_own') then
    create policy feedback_insert_own on public.feedback
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feedback' and policyname='feedback_read_own') then
    create policy feedback_read_own on public.feedback
      for select using (user_id = auth.uid());
  end if;
end $$;
