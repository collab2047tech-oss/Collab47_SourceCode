-- 0027_message_client_id.sql
-- Adds a client-generated id to messages so optimistic-send temp bubbles can be
-- reconciled deterministically against the realtime INSERT echo (the same trick
-- iMessage / Signal use to de-dupe an optimistic send). The composer generates a
-- crypto.randomUUID(), renders the temp bubble keyed by it, sends it through the
-- send action, and the realtime payload carries it back so the thread maps the
-- echo -> temp without fragile (body, timestamp) matching.
--
-- REPLICA IDENTITY FULL is already set on public.messages (0022), so the INSERT
-- and UPDATE realtime payloads will include client_id with no further change.
-- No RLS change is needed: client_id is written by the sender on insert and is
-- already covered by the existing message-insert policy.

alter table public.messages add column if not exists client_id text;

create index if not exists messages_client_id_idx on public.messages (client_id);
