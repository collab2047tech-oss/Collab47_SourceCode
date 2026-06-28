-- 0041_connections_guard.sql
-- CRITICAL privacy bypass. connections UPDATE policy is just
-- (auth.uid() = user_a_id OR auth.uid() = user_b_id) with no requested_by guard,
-- so the REQUESTER can self-accept their own pending request (set
-- status='accepted'). Because is_connected() gates private-profile content
-- (posts, resume - migrations 0030/0034), a malicious user could request a
-- connection to ANY private profile, self-accept, and then read that user's
-- gated content WITHOUT consent.
--
-- Guard: a real end-user may not change the identity/provenance columns and may
-- not accept a request they themselves sent. Only the OTHER party can accept.
-- Service role (auth.uid() null) and the server actions remain unaffected.

create or replace function public.guard_connections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    -- pair + provenance are immutable after insert (block re-pointing then accepting)
    new.user_a_id    := old.user_a_id;
    new.user_b_id    := old.user_b_id;
    new.requested_by := old.requested_by;
    -- only the NON-requester may move a request to accepted
    if new.status = 'accepted'
       and old.status is distinct from 'accepted'
       and auth.uid() = old.requested_by then
      raise exception 'requester cannot accept their own connection request';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_connections on public.connections;
create trigger trg_guard_connections
  before update on public.connections
  for each row execute function public.guard_connections();
