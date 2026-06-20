-- Group chat: conversations need a human-readable title for type='group'.
-- 1:1 conversations leave this null and derive their header from the other member.
alter table public.conversations add column if not exists title text;
