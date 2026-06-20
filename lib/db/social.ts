import { getSupabaseServer } from "@/lib/supabase/server";
import { createNotification, getActorDisplayInfo } from "@/lib/db/notifications";

export interface MiniProfile {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
  branch: string | null;
}

interface OkResult { ok: true }
interface ErrResult { ok: false; error: string }
type Result = OkResult | ErrResult;

function canonical(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getFollowState(targetUserId: string) {
  const sb = await getSupabaseServer();
  if (!sb) return { isFollowing: false, isFollower: false, isConnected: false, isMutual: false };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { isFollowing: false, isFollower: false, isConnected: false, isMutual: false };

  const [a, b] = canonical(user.id, targetUserId);
  const [{ data: following }, { data: follower }, { data: conn }] = await Promise.all([
    sb.from("follows").select("*").eq("follower_id", user.id).eq("following_id", targetUserId).maybeSingle(),
    sb.from("follows").select("*").eq("follower_id", targetUserId).eq("following_id", user.id).maybeSingle(),
    sb.from("connections").select("status").eq("user_a_id", a).eq("user_b_id", b).maybeSingle(),
  ]);

  const isFollowing = Boolean(following);
  const isFollower = Boolean(follower);
  return {
    isFollowing,
    isFollower,
    isConnected: conn?.status === "accepted",
    isMutual: isFollowing && isFollower,
  };
}

export async function getConnectionStatus(
  targetUserId: string
): Promise<"none" | "pending" | "connected"> {
  const sb = await getSupabaseServer();
  if (!sb) return "none";
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.id === targetUserId) return "none";

  const [a, b] = canonical(user.id, targetUserId);
  const { data } = await sb
    .from("connections")
    .select("status")
    .eq("user_a_id", a)
    .eq("user_b_id", b)
    .maybeSingle();

  if (!data) return "none";
  return data.status === "accepted" ? "connected" : "pending";
}

export async function followUser(targetUserId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };

  // Fire-and-forget notification to the followed user.
  void (async () => {
    try {
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      await createNotification({
        userId: targetUserId,
        kind: "follow",
        actorName: actor.name,
        text: `${actor.name} started following you`,
        href: `/u/${actor.handle}`,
      });
    } catch { /* best-effort */ }
  })();

  return { ok: true };
}

export async function unfollowUser(targetUserId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function requestConnection(targetUserId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const [a, b] = canonical(user.id, targetUserId);
  const { error } = await sb
    .from("connections")
    .insert({ user_a_id: a, user_b_id: b, status: "pending", requested_by: user.id });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };

  // Notify the recipient of the pending connection request.
  void (async () => {
    try {
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      await createNotification({
        userId: targetUserId,
        kind: "connection_request",
        actorName: actor.name,
        text: `${actor.name} wants to connect`,
        href: `/u/${actor.handle}`,
      });
    } catch { /* best-effort */ }
  })();

  return { ok: true };
}

export async function acceptConnection(otherUserId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const [a, b] = canonical(user.id, otherUserId);
  const { error } = await sb
    .from("connections")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("user_a_id", a).eq("user_b_id", b);
  if (error) return { ok: false, error: error.message };

  // Fire-and-forget: notify the other user that their request was accepted.
  void (async () => {
    try {
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      await createNotification({
        userId: otherUserId,
        kind: "system",
        actorName: actor.name,
        text: `${actor.name} accepted your connection request`,
        href: `/u/${actor.handle}`,
      });
    } catch { /* best-effort */ }
  })();

  return { ok: true };
}

export async function cancelConnection(otherUserId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const [a, b] = canonical(user.id, otherUserId);
  const { error } = await sb.from("connections").delete().eq("user_a_id", a).eq("user_b_id", b);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMyConnections(
  kind: "all" | "followers" | "following" | "pending"
): Promise<MiniProfile[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const cols = "id, handle, name, avatar_url, college, branch";

  if (kind === "following") {
    const { data } = await sb
      .from("follows")
      .select(`following:profiles!follows_following_id_fkey(${cols})`)
      .eq("follower_id", user.id);
    return (data ?? []).map((r) => (r as unknown as { following: MiniProfile }).following);
  }
  if (kind === "followers") {
    const { data } = await sb
      .from("follows")
      .select(`follower:profiles!follows_follower_id_fkey(${cols})`)
      .eq("following_id", user.id);
    return (data ?? []).map((r) => (r as unknown as { follower: MiniProfile }).follower);
  }
  if (kind === "pending") {
    const { data } = await sb
      .from("connections")
      .select("user_a_id, user_b_id, status")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .eq("status", "pending");
    const otherIds = (data ?? []).map((c) =>
      c.user_a_id === user.id ? (c.user_b_id as string) : (c.user_a_id as string)
    );
    if (otherIds.length === 0) return [];
    const { data: profs } = await sb.from("profiles").select(cols).in("id", otherIds);
    return (profs as MiniProfile[]) ?? [];
  }

  // all = accepted connections
  const { data } = await sb
    .from("connections")
    .select("user_a_id, user_b_id")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "accepted");
  const otherIds = (data ?? []).map((c) =>
    c.user_a_id === user.id ? (c.user_b_id as string) : (c.user_a_id as string)
  );
  if (otherIds.length === 0) return [];
  const { data: profs } = await sb.from("profiles").select(cols).in("id", otherIds);
  return (profs as MiniProfile[]) ?? [];
}

export interface PendingConnections {
  /** Requests OTHERS sent to me — show Accept / Reject. */
  incoming: MiniProfile[];
  /** Requests I sent that are still pending — show as "Pending". */
  outgoing: MiniProfile[];
}

/**
 * Split pending connection requests into INCOMING (the other user initiated —
 * I can Accept/Reject) and OUTGOING (I initiated — still waiting).
 * Uses connections.requested_by to determine the initiator. If requested_by is
 * null on a legacy row, the request is treated as incoming so it never gets
 * silently hidden from the recipient.
 */
export async function getPendingConnections(): Promise<PendingConnections> {
  const empty: PendingConnections = { incoming: [], outgoing: [] };
  const sb = await getSupabaseServer();
  if (!sb) return empty;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return empty;

  const cols = "id, handle, name, avatar_url, college, branch";

  const { data: rows } = await sb
    .from("connections")
    .select("user_a_id, user_b_id, requested_by")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "pending");

  if (!rows || rows.length === 0) return empty;

  const incomingIds: string[] = [];
  const outgoingIds: string[] = [];
  for (const c of rows) {
    const otherId = c.user_a_id === user.id ? (c.user_b_id as string) : (c.user_a_id as string);
    if (c.requested_by === user.id) outgoingIds.push(otherId);
    else incomingIds.push(otherId);
  }

  const allIds = [...incomingIds, ...outgoingIds];
  const { data: profs } = await sb.from("profiles").select(cols).in("id", allIds);
  const byId = new Map<string, MiniProfile>();
  for (const p of (profs as MiniProfile[]) ?? []) byId.set(p.id, p);

  return {
    incoming: incomingIds.map((id) => byId.get(id)).filter(Boolean) as MiniProfile[],
    outgoing: outgoingIds.map((id) => byId.get(id)).filter(Boolean) as MiniProfile[],
  };
}

/**
 * Set of user ids the given viewer already has a relationship with and who must
 * therefore be EXCLUDED from "people you may know" suggestions:
 *   - everyone the viewer already FOLLOWS (follows.follower_id = me)
 *   - the other party of any connection in EITHER direction, regardless of
 *     status (accepted OR pending), so both already-connected people and
 *     in-flight requests stop being suggested.
 * The viewer's own id is included so callers can filter it in one pass.
 */
export async function getExcludedSuggestionIds(viewerId: string): Promise<Set<string>> {
  const sb = await getSupabaseServer();
  const excluded = new Set<string>([viewerId]);
  if (!sb) return excluded;

  const [{ data: follows }, { data: conns }] = await Promise.all([
    sb.from("follows").select("following_id").eq("follower_id", viewerId),
    sb
      .from("connections")
      .select("user_a_id, user_b_id")
      .or(`user_a_id.eq.${viewerId},user_b_id.eq.${viewerId}`)
      .in("status", ["accepted", "pending"]),
  ]);

  for (const f of follows ?? []) excluded.add(f.following_id as string);
  for (const c of conns ?? []) {
    excluded.add(c.user_a_id as string);
    excluded.add(c.user_b_id as string);
  }
  return excluded;
}

export async function getSuggestedConnections(limit = 10): Promise<MiniProfile[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  const cols = "id, handle, name, avatar_url, college, branch";

  if (user) {
    // People the viewer already follows / is connected with / has a pending
    // request with (either direction) must never be suggested.
    const excluded = await getExcludedSuggestionIds(user.id);
    // Over-fetch so that filtering out excluded ids still leaves up to `limit`.
    const fetchLimit = limit + excluded.size;

    const { data: me } = await sb.from("profiles").select("college, branch, cluster_id").eq("id", user.id).maybeSingle();
    if (me?.college) {
      const { data } = await sb
        .from("profiles")
        .select(cols)
        .eq("college", me.college)
        .neq("id", user.id)
        .is("deleted_at", null)
        .is("suspended_at", null)
        .limit(fetchLimit);
      const filtered = (data as MiniProfile[] ?? []).filter((p) => !excluded.has(p.id));
      if (filtered.length > 0) return filtered.slice(0, limit);
    }
    // Fallback: any other real users (never self, never suspended, never
    // already-followed/connected/pending). Keep college-affinity ordering by
    // only reaching here when the college query produced nothing usable.
    const { data } = await sb.from("profiles").select(cols).neq("id", user.id).is("deleted_at", null).is("suspended_at", null).limit(fetchLimit);
    return (data as MiniProfile[] ?? []).filter((p) => !excluded.has(p.id)).slice(0, limit);
  }

  const { data } = await sb.from("profiles").select(cols).is("deleted_at", null).is("suspended_at", null).limit(limit);
  return (data as MiniProfile[]) ?? [];
}

/**
 * For a list of user ids, return the viewer's relationship to each so that
 * Follow/Connect buttons can render the correct state (Following / Connected /
 * Pending) instead of always showing "Follow". Used by pages that render people
 * who may already be followed or connected (e.g. search / explore results).
 */
export interface RelationshipState {
  isFollowing: boolean;
  isConnected: boolean;
  pending: boolean;
}

export async function getRelationshipStates(
  ids: string[]
): Promise<Record<string, RelationshipState>> {
  const out: Record<string, RelationshipState> = {};
  const sb = await getSupabaseServer();
  if (!sb || ids.length === 0) return out;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return out;

  const targets = ids.filter((id) => id !== user.id);
  if (targets.length === 0) return out;

  const [{ data: follows }, { data: conns }] = await Promise.all([
    sb.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", targets),
    sb
      .from("connections")
      .select("user_a_id, user_b_id, status")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .in("status", ["accepted", "pending"]),
  ]);

  const followingSet = new Set((follows ?? []).map((f) => f.following_id as string));
  const connectedSet = new Set<string>();
  const pendingSet = new Set<string>();
  for (const c of conns ?? []) {
    const otherId = c.user_a_id === user.id ? (c.user_b_id as string) : (c.user_a_id as string);
    if (c.status === "accepted") connectedSet.add(otherId);
    else pendingSet.add(otherId);
  }

  for (const id of targets) {
    out[id] = {
      isFollowing: followingSet.has(id),
      isConnected: connectedSet.has(id),
      pending: pendingSet.has(id),
    };
  }
  return out;
}

export async function searchAll(query: string, limit = 20) {
  const sb = await getSupabaseServer();
  const q = query.trim();
  if (!sb || !q) return { people: [], posts: [], projects: [], hashtags: [] };

  // Keep Unicode letters/numbers (so Hindi/Devanagari search works); strip only
  // tsquery-breaking punctuation. Bail if nothing usable remains.
  const tsq = q.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean).join(" & ");
  if (!tsq) return { people: [], posts: [], projects: [], hashtags: [] };

  const [people, posts, projects, hashtags] = await Promise.all([
    sb.from("profiles").select("id, handle, name, avatar_url, college, branch").textSearch("search_tsv", tsq).is("deleted_at", null).is("suspended_at", null).limit(limit),
    sb.from("posts").select("id, short_id, body, author_id").textSearch("search_tsv", tsq).is("deleted_at", null).limit(limit),
    sb.from("projects").select("id, short_id, title, brief").textSearch("search_tsv", tsq).limit(limit),
    sb.from("hashtags").select("tag, use_count").ilike("tag", `%${q}%`).limit(limit),
  ]);

  return {
    people: people.data ?? [],
    posts: posts.data ?? [],
    projects: projects.data ?? [],
    hashtags: hashtags.data ?? [],
  };
}
