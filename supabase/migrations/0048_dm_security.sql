-- 0048_dm_security.sql
-- LAUNCH BLOCKER FIX: the DM permission matrix was enforced ONLY in app-layer
-- computeIsRequest and was bypassable by a direct Supabase REST insert/update
-- (a member could insert is_request=false to jump a cold DM straight into the
-- recipient's main inbox, an applicant could message a project author, and
-- groups had no size cap). Enforce it all at the DB with SECURITY DEFINER
-- triggers so no client can bypass it.

-- Eligible for the main inbox (no request gate): accepted connection, mutual
-- follow, project author -> their applicant, or shared team.
create or replace function public.dm_main_inbox_ok(p_sender uuid, p_recipient uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_sender is null or p_recipient is null then return false; end if;
  if public.is_connected(p_sender, p_recipient) then return true; end if;
  if exists (select 1 from follows a where a.follower_id = p_sender and a.following_id = p_recipient)
     and exists (select 1 from follows b where b.follower_id = p_recipient and b.following_id = p_sender)
  then return true; end if;
  if exists (select 1 from project_applications pa join projects pr on pr.id = pa.project_id
             where pr.author_id = p_sender and pa.applicant_id = p_recipient) then return true; end if;
  if exists (select 1 from project_members m1 join project_members m2 on m1.project_id = m2.project_id
             where m1.user_id = p_sender and m2.user_id = p_recipient) then return true; end if;
  return false;
end $$;

-- Authoritative is_request routing + hard blocks, forced on every message insert.
create or replace function public.enforce_dm_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare mcount int; other uuid; has_active boolean; recip_perm text; app_cold boolean;
begin
  if auth.uid() is null then return new; end if;               -- service role: trusted (accept/system)
  select count(*) into mcount from public.conversation_members where conversation_id = new.conversation_id;
  if mcount > 2 then new.is_request := false; return new; end if;  -- group: members are creator-vetted
  select user_id into other from public.conversation_members
    where conversation_id = new.conversation_id and user_id <> new.sender_id limit 1;
  if other is null then new.is_request := false; return new; end if;

  -- block either direction
  if exists (select 1 from public.blocks
             where (blocker_id = other and blocked_id = new.sender_id)
                or (blocker_id = new.sender_id and blocked_id = other)) then
    raise exception 'You cannot message this person.';
  end if;

  -- existing ACTIVE thread (any accepted message) -> keep main inbox
  select exists (select 1 from public.messages m
                 where m.conversation_id = new.conversation_id and m.is_request = false) into has_active;
  if has_active then new.is_request := false; return new; end if;

  -- applicant cold-messaging a project author they applied to: blocked (unless otherwise main-inbox-ok)
  select exists (select 1 from public.project_applications pa join public.projects pr on pr.id = pa.project_id
                 where pr.author_id = other and pa.applicant_id = new.sender_id) into app_cold;
  if app_cold and not public.dm_main_inbox_ok(new.sender_id, other) then
    raise exception 'Applicants cannot message project authors first.';
  end if;

  if public.dm_main_inbox_ok(new.sender_id, other) then new.is_request := false; return new; end if;

  -- recipient DM permission for a cold contact
  select coalesce(dm_permission, 'everyone') into recip_perm from public.profiles where id = other;
  if recip_perm = 'nobody' then raise exception 'This person is not accepting new messages.'; end if;
  if recip_perm = 'connections' then raise exception 'This person only accepts messages from connections.'; end if;

  new.is_request := true;   -- stranger -> Requests folder (forced, client cannot set false)
  return new;
end $$;

drop trigger if exists trg_enforce_dm_insert on public.messages;
create trigger trg_enforce_dm_insert before insert on public.messages
  for each row execute function public.enforce_dm_insert();

-- Guard: an end user cannot tamper is_request (jump Requests -> main) or forge
-- read_at on UPDATE. Acceptance / read-receipts run via the service role
-- (auth.uid() null) and are unaffected.
create or replace function public.guard_message_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.is_request := old.is_request;
    new.read_at := old.read_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update before update on public.messages
  for each row execute function public.guard_message_update();

-- Group chat hard cap of 8 members (atomic via per-conversation advisory lock).
create or replace function public.enforce_group_member_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  perform pg_advisory_xact_lock(hashtext(new.conversation_id::text));
  select count(*) into cnt from public.conversation_members where conversation_id = new.conversation_id;
  if cnt >= 8 then raise exception 'Group chats are limited to 8 members.'; end if;
  return new;
end $$;

drop trigger if exists trg_enforce_group_cap on public.conversation_members;
create trigger trg_enforce_group_cap before insert on public.conversation_members
  for each row execute function public.enforce_group_member_cap();
