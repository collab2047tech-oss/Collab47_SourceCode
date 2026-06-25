-- ========================================================================
-- Neural feed ranker — training-data capture + model store.
--   feed_training : the per-(viewer,post) feature vector AS SERVED (the model's
--                   X). Joined with feed_events/likes (the label y) by the
--                   offline trainer. RLS: a user only writes their own rows.
--   ranker_model  : the single trained model (logreg or MLP weights, jsonb) +
--                   its holdout AUC. `active` gates whether the live feed uses
--                   it — it stays FALSE (MCDM engine) until trained on real data
--                   and proven to beat chance.
-- Training is OFFLINE (scripts/train-ranker.mjs via GitHub Actions) — zero
-- deployment cost. Inference is a plain-JS forward pass at serve time.
-- ========================================================================

create table if not exists public.feed_training (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  post_id   uuid not null references public.posts(id) on delete cascade,
  features  real[] not null,
  served_at timestamptz not null default now()
);
alter table public.feed_training enable row level security;
drop policy if exists ft_insert_self on public.feed_training;
create policy ft_insert_self on public.feed_training for insert with check (user_id = auth.uid());
create index if not exists feed_training_user_post_idx on public.feed_training (user_id, post_id);
create index if not exists feed_training_served_idx on public.feed_training (served_at);

create table if not exists public.ranker_model (
  id         int primary key default 1,
  model      jsonb not null,
  auc        real,
  n_train    int,
  n_features int,
  trained_at timestamptz default now(),
  active     boolean default false
);
