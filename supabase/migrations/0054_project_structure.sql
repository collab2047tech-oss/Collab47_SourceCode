-- 0054_project_structure.sql
-- Founder-approved (Q1): structured projects for the Upwork-style collab flow.
-- Additive only; existing rows get sensible defaults and nothing breaks.

-- Roles the project needs. Array of objects:
--   [{ "title": "Frontend dev", "skills": ["react","ts"], "count": 1 }]
alter table public.projects add column if not exists roles jsonb not null default '[]'::jsonb;

-- Expected commitment in hours per week (nullable = author did not say).
alter table public.projects add column if not exists commitment_hours int;

-- Expected duration, freeform but short ("6 weeks", "3 months").
alter table public.projects add column if not exists duration text;

-- Category slug for filtering (web, mobile, ml, research, design, hardware, social, other).
alter table public.projects add column if not exists category text;

-- Wave-1 removed the slot UI; the action hardcodes 4. Give the column a real
-- default so the hardcode can die.
alter table public.projects alter column slot_count set default 4;

create index if not exists projects_category_idx on public.projects (category) where category is not null;
