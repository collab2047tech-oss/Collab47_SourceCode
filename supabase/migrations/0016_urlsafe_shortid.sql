-- short_id was base64 (contains + / =) which breaks URLs like /p/9npe+a55.
-- Switch to URL-safe hex and backfill any unsafe existing ids.
alter table public.posts    alter column short_id set default substring(encode(gen_random_bytes(8),'hex') from 1 for 10);
alter table public.projects alter column short_id set default substring(encode(gen_random_bytes(8),'hex') from 1 for 10);

update public.posts    set short_id = substring(encode(gen_random_bytes(8),'hex') from 1 for 10) where short_id ~ '[+/=]';
update public.projects set short_id = substring(encode(gen_random_bytes(8),'hex') from 1 for 10) where short_id ~ '[+/=]';
