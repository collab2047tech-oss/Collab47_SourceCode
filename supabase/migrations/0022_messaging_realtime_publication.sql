-- 0022_messaging_realtime_publication.sql
-- Ensure Realtime is enabled for messaging + notifications so the client
-- subscriptions in MessageThread / NotificationsList receive INSERT and UPDATE
-- events. This is idempotent and safe to run even if Realtime was already
-- enabled out-of-band on a prior environment.
--
-- REPLICA IDENTITY FULL is required so UPDATE payloads (e.g. read_at being
-- stamped for "Seen" read receipts) carry the complete new row to subscribers.

-- Add tables to the supabase_realtime publication if not already members.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- Full row images on UPDATE so read-receipt ("Seen") changes propagate fully.
alter table public.messages replica identity full;
alter table public.notifications replica identity full;
