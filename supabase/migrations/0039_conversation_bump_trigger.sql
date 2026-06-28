-- 0039_conversation_bump_trigger.sql
-- BUG: sending a message bumped conversations.last_message_at via the AUTHED
-- client, but conversations has no UPDATE policy (RLS), so the bump silently
-- failed - leaving conversation ordering stale on a fresh server load. Replace
-- the (failing) manual update with a SECURITY DEFINER trigger that bumps it
-- automatically on every message insert. Always correct, no RLS dependency.

create or replace function public.bump_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_conversation_last_message on public.messages;
create trigger trg_bump_conversation_last_message
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();
