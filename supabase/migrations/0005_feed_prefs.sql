-- Day 10: feed preferences + impressions counter.

alter table public.profiles
  add column if not exists feed_prefs jsonb not null
  default '{"only_follows": false, "hide_news": false, "hide_projects": false}';

alter table public.posts
  add column if not exists impressions int not null default 0;
