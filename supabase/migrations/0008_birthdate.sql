-- Add birthdate to profiles (collected at onboarding).
alter table public.profiles add column if not exists birthdate date;
