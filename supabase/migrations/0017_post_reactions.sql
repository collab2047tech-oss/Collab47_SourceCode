-- Add reaction column to likes table.
-- Existing rows default to 'like', preserving all existing like data.
-- The like_count trigger counts rows (total reactions), so no trigger change needed.
alter table public.likes
  add column if not exists reaction text not null default 'like'
  check (reaction in ('like','celebrate','support','love','insightful','funny'));
