-- 0015_projects_progress
-- Adds:
--   posts.project_id          nullable FK -> projects (progress posts)
--   projects.delivered_at     timestamptz nullable (outcome timestamp)
--   projects.deliverable_url  text nullable (link to the shipped artifact)
--   project_members.is_verified boolean default false (verified-contributor badge)

-- ---------------------------------------------------------------------------
-- posts: link a post to a project as a progress update
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists posts_project_id_idx on public.posts (project_id)
  where project_id is not null;

-- ---------------------------------------------------------------------------
-- projects: outcome fields
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists delivered_at timestamptz,
  add column if not exists deliverable_url text;

-- ---------------------------------------------------------------------------
-- project_members: verified-contributor badge
-- ---------------------------------------------------------------------------
alter table public.project_members
  add column if not exists is_verified boolean not null default false;
