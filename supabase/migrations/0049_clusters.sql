-- 0049_clusters.sql
-- Community detection: each profile gets a cluster_id computed by Louvain
-- modularity optimization over the REAL follow + accepted-connection graph
-- (see lib/clustering/computeClusters.ts, run by /api/cron/clusters). No AI, no
-- synthetic data - pure graph structure of who actually follows/connects to whom.
alter table public.profiles add column if not exists cluster_id integer;
create index if not exists profiles_cluster_idx on public.profiles (cluster_id) where cluster_id is not null;
