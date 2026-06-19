-- The 3-strike auto-hide trigger updates the reported post (owned by another
-- user). Without SECURITY DEFINER it runs in the reporter's RLS context and the
-- UPDATE is blocked, so posts never auto-hide at the threshold. Fix:
alter function public.tg_three_strike_autohide() security definer;
alter function public.tg_three_strike_autohide() set search_path = public;
