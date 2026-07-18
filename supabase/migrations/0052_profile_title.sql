-- 0052_profile_title.sql
-- Optional honorific shown before a member's name (Mr, Mrs, Ms, Dr, Prof, Er).
-- Deliberately free text rather than an enum so the list can grow without a
-- migration; the app constrains the choices in the UI.
alter table public.profiles add column if not exists title text;
