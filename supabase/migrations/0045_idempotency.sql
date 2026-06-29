-- 0045_idempotency.sql
-- Double-submit / retry idempotency.
-- (1) Reposts had no uniqueness: a double-click created two repost rows and
--     double-bumped repost_count. One repost per user per original.
-- (2) Messages: client_id had only a non-unique index, so a retry/double-submit
--     duplicated the message. One message per (sender, client_id).

create unique index if not exists posts_one_repost_per_user
  on public.posts (author_id, reposted_from_post_id)
  where is_repost = true and reposted_from_post_id is not null;

create unique index if not exists messages_sender_client_uniq
  on public.messages (sender_id, client_id)
  where client_id is not null;
