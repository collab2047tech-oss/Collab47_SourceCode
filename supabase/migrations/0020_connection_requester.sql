-- Track WHO initiated a connection request so the recipient can be shown
-- incoming invitations (Accept / Reject) separately from their own outgoing
-- pending requests. Nullable to remain compatible with any pre-existing rows.
alter table public.connections
  add column if not exists requested_by uuid references public.profiles(id);
