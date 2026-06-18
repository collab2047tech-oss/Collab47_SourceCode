-- 0006_profile_settings.sql
-- Adds privacy and notification_prefs jsonb columns to profiles.

alter table public.profiles
  add column if not exists privacy jsonb not null
    default '{"public_profile": true, "searchable": true, "read_receipts": false}';

alter table public.profiles
  add column if not exists notification_prefs jsonb not null
    default '{}';
