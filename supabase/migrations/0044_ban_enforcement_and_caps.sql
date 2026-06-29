-- 0044_ban_enforcement_and_caps.sql

-- 1) CRITICAL: a suspended/deleted user could still INSERT (post, comment, DM,
--    project, follow, connect, report) via Server Actions - the only ban gates
--    were render-time (layout) + read-time (0043). The 3-strike trigger sets
--    suspended_at but does NOT revoke the JWT, so the banned session kept
--    writing. Enforce at the DB with a BEFORE INSERT trigger on every
--    user-facing content table: a real end-user (auth.uid() not null) whose
--    account is suspended or deleted cannot insert. Service role (auth.uid()
--    null) is unaffected.
create or replace function public.is_account_active(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where id = uid and (suspended_at is not null or deleted_at is not null)
  );
$$;

create or replace function public.block_banned_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_account_active(auth.uid()) then
    raise exception 'account is suspended or closed';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'posts','comments','messages','projects','project_applications',
    'events','news_comments','follows','connections','reports',
    'likes','bookmarks','comment_likes','news_reactions','news_saves'
  ] loop
    execute format('drop trigger if exists trg_block_banned_insert on public.%I', t);
    execute format('create trigger trg_block_banned_insert before insert on public.%I for each row execute function public.block_banned_insert()', t);
  end loop;
end $$;

-- 2) HIGH: comments_read_all was `using (true)` - comments (bodies + commenter
--    identities) on a hidden post (private/suspended/deleted author) were
--    world-readable directly by post_id. Mirror posts_read_public: a comment is
--    visible only if its post is visible to the viewer.
drop policy if exists comments_read_all on public.comments;
create policy comments_read_all on public.comments
  for select using (
    exists (
      select 1 from public.posts p
      join public.profiles pr on pr.id = p.author_id
      where p.id = comments.post_id
        and p.deleted_at is null
        and pr.deleted_at is null
        and pr.suspended_at is null
        and (pr.is_private is not true or pr.id = auth.uid() or public.is_connected(auth.uid(), pr.id))
    )
  );

-- 3) HIGH: the 5-member team cap (acceptApplicant) was a TOCTOU race - two
--    concurrent accepts both read count=4 and both insert, landing at 6+. Make
--    it atomic with a per-project advisory lock + count inside a BEFORE INSERT
--    trigger so concurrent accepts serialize and the 6th insert is rejected.
create or replace function public.enforce_project_member_cap()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare cnt int;
begin
  perform pg_advisory_xact_lock(hashtext(new.project_id::text));
  select count(*) into cnt from public.project_members where project_id = new.project_id;
  if cnt >= 5 then
    raise exception 'project team is full (max 5 members)';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_member_cap on public.project_members;
create trigger trg_project_member_cap
  before insert on public.project_members
  for each row execute function public.enforce_project_member_cap();
