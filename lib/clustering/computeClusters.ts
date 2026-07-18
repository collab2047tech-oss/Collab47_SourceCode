import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { getAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Community detection (Louvain) over the REAL social graph.
//
// This is how real networks ("people from your cluster" / LinkedIn communities)
// actually work: a classical modularity-optimization algorithm run over the true
// edges of who follows and connects to whom. NOT AI, NOT synthetic, NOT mock -
// it reads the live follows + accepted connections and partitions users into the
// communities that emerge from their real interactions. As more people join and
// connect, the clusters get sharper on their own.
//
// Edge weights: a mutual/accepted CONNECTION is a stronger tie (3) than a one-way
// FOLLOW (1); parallel edges accumulate weight (mutual follow => 2).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(admin: any, table: string, cols: string): Promise<any[]> {
  const out: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + size - 1);
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

export interface ClusterResult {
  ok: boolean;
  users: number;
  communities: number;
  edges: number;
  error?: string;
}

export async function computeAndStoreClusters(): Promise<ClusterResult> {
  const admin = getAdminClient();
  if (!admin) return { ok: false, users: 0, communities: 0, edges: 0, error: "no admin client" };

  const g = new Graph({ type: "undirected" });
  const node = (id?: string | null) => {
    if (id && !g.hasNode(id)) g.addNode(id);
  };
  const edge = (a?: string | null, b?: string | null, w = 1) => {
    if (!a || !b || a === b) return;
    node(a); node(b);
    if (g.hasEdge(a, b)) {
      g.setEdgeAttribute(a, b, "weight", (g.getEdgeAttribute(a, b, "weight") || 1) + w);
    } else {
      g.addEdge(a, b, { weight: w });
    }
  };

  // Real edges only.
  const follows = await fetchAll(admin, "follows", "follower_id, following_id");
  for (const f of follows) edge(f.follower_id, f.following_id, 1);
  const conns = await fetchAll(admin, "connections", "user_a_id, user_b_id, status");
  for (const c of conns) if (c.status === "accepted") edge(c.user_a_id, c.user_b_id, 3);

  if (g.order === 0) return { ok: true, users: 0, communities: 0, edges: 0 };

  // Louvain modularity optimization.
  const communities = louvain(g, { getEdgeWeight: "weight", resolution: 1 }) as Record<string, number>;

  // Group members by raw community, then assign compact 0..N-1 cluster ids.
  const byComm = new Map<number, string[]>();
  for (const [uid, cid] of Object.entries(communities)) {
    const arr = byComm.get(cid);
    if (arr) arr.push(uid);
    else byComm.set(cid, [uid]);
  }

  let idx = 0;
  for (const [, members] of byComm) {
    const cluster = idx++;
    for (let i = 0; i < members.length; i += 200) {
      const chunk = members.slice(i, i + 200);
      await admin.from("profiles").update({ cluster_id: cluster }).in("id", chunk);
    }
  }

  return { ok: true, users: g.order, communities: byComm.size, edges: g.size };
}
