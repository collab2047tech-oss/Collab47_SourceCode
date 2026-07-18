import { getSupabaseServer } from "@/lib/supabase/server";
import { createNotification, getActorDisplayInfo } from "@/lib/db/notifications";
import { semanticMatch } from "@/lib/ranker/taxonomy";
import { fieldProximity } from "@/lib/ranker/features";
import { overLimit, LIMITS, RATE_LIMITED } from "@/lib/security/ratelimit";

export interface MiniProfile {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
  branch: string | null;
  /** Cohort fields used by the ranker (null-safe). Selected where available. */
  interests?: string[] | null;
  year_of_study?: string | null;
  city?: string | null;
  verified?: boolean | null;
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
  if (await overLimit(sb, { table: "follows", userColumn: "follower_id", userId: user.id, ...LIMITS.follow })) {
    return { ok: false, error: RATE_LIMITED };
  }
  // Upsert with ignoreDuplicates so a repeat follow is a silent no-op, and
  // .select() so we can tell whether a row was GENUINELY created (returns the
  // row) vs already existed (returns nothing) - we only notify on a new follow.
  const { data: inserted, error } = await sb
    .from("follows")
    .upsert({ follower_id: user.id, following_id: targetUserId }, { ignoreDuplicates: true })
    .select("follower_id");
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  const isNew = (inserted?.length ?? 0) > 0;

  // Fire-and-forget notification to the followed user - only when newly created.
  if (isNew) void (async () => {
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
  if (await overLimit(sb, { table: "connections", userColumn: "requested_by", userId: user.id, ...LIMITS.follow })) {
    return { ok: false, error: RATE_LIMITED };
  }
  const [a, b] = canonical(user.id, targetUserId);
  // Upsert with ignoreDuplicates + .select() so we only notify when this insert
  // genuinely created the connection row (an existing request returns no row).
  const { data: inserted, error } = await sb
    .from("connections")
    .upsert(
      { user_a_id: a, user_b_id: b, status: "pending", requested_by: user.id },
      { ignoreDuplicates: true }
    )
    .select("user_a_id");
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  const isNew = (inserted?.length ?? 0) > 0;

  // Notify the recipient of the pending connection request - only when new.
  if (isNew) void (async () => {
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
  // Defense in depth: only the NON-requester may accept, and only a row that is
  // still pending may flip to accepted. This mirrors the RLS `with check` so a
  // user can never "accept" their own outgoing request or re-accept a row.
  const { data: updated, error } = await sb
    .from("connections")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("user_a_id", a).eq("user_b_id", b)
    .eq("status", "pending")
    .neq("requested_by", user.id)
    .select("user_a_id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "No pending request to accept" };
  }

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
  /** Requests OTHERS sent to me - show Accept / Reject. */
  incoming: MiniProfile[];
  /** Requests I sent that are still pending - show as "Pending". */
  outgoing: MiniProfile[];
}

/**
 * Split pending connection requests into INCOMING (the other user initiated -
 * I can Accept/Reject) and OUTGOING (I initiated - still waiting).
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

// Cohort columns the ranker needs (interests / year / city / verified) plus the
// display columns. Used by every suggestion path so ranking is possible.
const SUGGEST_COLS =
  "id, handle, name, avatar_url, college, branch, interests, year_of_study, city, verified, cluster_id";

export async function getSuggestedConnections(limit = 10): Promise<MiniProfile[]> {
  const ranked = await getSuggestedPeople(limit);
  // Backward-compatible shape: the ranked rows ARE MiniProfiles (+ extra fields
  // that consumers ignore). Strip the suggestion metadata for legacy callers.
  return ranked.map(({ reason: _r, mutualCount: _m, ...p }) => p);
}

export interface SuggestedPerson extends MiniProfile {
  /** Human-readable "why suggested" string, in the spirit of the feed's reasons. */
  reason: string;
  mutualCount: number;
}

/**
 * Ranked "people you may know". Recalls a candidate pool (same college OR same
 * branch OR second-degree via the people you follow), excludes anyone the
 * viewer already follows / is connected with / has a pending request with, then
 * scores each candidate with the SAME classical engine the feed uses
 * (fieldProximity for college/branch/city/year + semanticMatch over interests +
 * a mutual-follow count). Fixes the old exact-college `.eq` + random fallback.
 */
export async function getSuggestedPeople(limit = 12): Promise<SuggestedPerson[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    const { data } = await sb
      .from("profiles")
      .select(SUGGEST_COLS)
      .is("deleted_at", null)
      .is("suspended_at", null)
      .not("privacy->>searchable", "eq", "false")
      .order("verified", { ascending: false })
      .limit(limit);
    return ((data as MiniProfile[] | null) ?? []).map((p) => ({
      ...p,
      reason: "On Collab47",
      mutualCount: 0,
    }));
  }

  const excluded = await getExcludedSuggestionIds(user.id);

  const { data: me } = await sb
    .from("profiles")
    .select("college, branch, city, year_of_study, interests, cluster_id")
    .eq("id", user.id)
    .maybeSingle();
  const myCluster = (me?.cluster_id as number | null) ?? null;

  // Mutual-follow recall: who do the people I follow also follow? Those are
  // strong PYMK candidates (second-degree network), mirroring feed.ts.
  const { data: myFollows } = await sb
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const followingIds = (myFollows ?? []).map((f) => f.following_id as string);

  const mutualCount = new Map<string, number>();
  if (followingIds.length > 0) {
    const { data: secondDegree } = await sb
      .from("follows")
      .select("following_id")
      .in("follower_id", followingIds)
      .limit(1000);
    for (const f of secondDegree ?? []) {
      const id = f.following_id as string;
      mutualCount.set(id, (mutualCount.get(id) ?? 0) + 1);
    }
  }

  // Candidate pool: same college OR same branch OR second-degree, de-duped.
  const candidates = new Map<string, MiniProfile>();
  const addRows = (rows: MiniProfile[] | null) => {
    for (const p of rows ?? []) {
      if (!excluded.has(p.id)) candidates.set(p.id, p);
    }
  };

  const secondDegreeIds = [...mutualCount.keys()].filter((id) => !excluded.has(id)).slice(0, 60);
  const pulls: Promise<void>[] = [];
  if (me?.college) {
    // Case-insensitive exact match (ilike with no wildcards) so "IISER Kolkata"
    // and "iiser kolkata" recall the same cohort. College names never contain
    // %/_ so they are not treated as wildcards here.
    const collegeNeedle = me.college.trim();
    pulls.push((async () => {
      const { data } = await sb.from("profiles").select(SUGGEST_COLS).ilike("college", collegeNeedle)
        .neq("id", user.id).is("deleted_at", null).is("suspended_at", null)
        .not("privacy->>searchable", "eq", "false").limit(60);
      addRows(data as MiniProfile[] | null);
    })());
  }
  if (me?.branch) {
    pulls.push((async () => {
      const { data } = await sb.from("profiles").select(SUGGEST_COLS).eq("branch", me.branch)
        .neq("id", user.id).is("deleted_at", null).is("suspended_at", null)
        .not("privacy->>searchable", "eq", "false").limit(60);
      addRows(data as MiniProfile[] | null);
    })());
  }
  if (secondDegreeIds.length > 0) {
    pulls.push((async () => {
      const { data } = await sb.from("profiles").select(SUGGEST_COLS).in("id", secondDegreeIds)
        .is("deleted_at", null).is("suspended_at", null)
        .not("privacy->>searchable", "eq", "false");
      addRows(data as MiniProfile[] | null);
    })());
  }
  // Community recall: people in your Louvain community (computed from the REAL
  // follow + connection graph, migration 0049 / cron). This is the true "people
  // from your cluster" signal - the community that emerges from actual ties, not
  // a college/branch guess.
  if (myCluster !== null) {
    pulls.push((async () => {
      const { data } = await sb.from("profiles").select(SUGGEST_COLS).eq("cluster_id", myCluster)
        .neq("id", user.id).is("deleted_at", null).is("suspended_at", null)
        .not("privacy->>searchable", "eq", "false").limit(80);
      addRows(data as MiniProfile[] | null);
    })());
  }
  await Promise.all(pulls);

  // Fallback: if recall is empty (sparse network), pull any real users so the
  // surface is never blank - they simply score low / get a generic reason.
  if (candidates.size === 0) {
    const { data } = await sb
      .from("profiles").select(SUGGEST_COLS)
      .neq("id", user.id).is("deleted_at", null).is("suspended_at", null)
      .not("privacy->>searchable", "eq", "false")
      .order("verified", { ascending: false }).limit(limit + excluded.size);
    addRows(data as MiniProfile[] | null);
  }

  const viewer = {
    college: me?.college ?? null,
    branch: me?.branch ?? null,
    city: me?.city ?? null,
    year: me?.year_of_study ?? null,
  };
  const myInterests = (me?.interests as string[] | null) ?? [];

  const scored = [...candidates.values()].map((p) => {
    const field = fieldProximity(viewer, p as unknown as Record<string, unknown>);
    const sem = myInterests.length
      ? semanticMatch(myInterests, (p.interests as string[] | null) ?? [])
      : 0;
    const mutuals = mutualCount.get(p.id) ?? 0;
    const mutualScore = Math.min(1, mutuals / 5);
    const sameCluster =
      myCluster !== null && (p as { cluster_id?: number | null }).cluster_id === myCluster;
    const score =
      field.score + 0.6 * sem + 0.5 * mutualScore + (sameCluster ? 0.55 : 0) + (p.verified ? 0.05 : 0);

    // Reason string, most specific signal first (LinkedIn PYMK style).
    let reason = "On Collab47";
    if (mutuals >= 1) reason = `${mutuals} mutual connection${mutuals === 1 ? "" : "s"}`;
    else if (field.sameCollege) reason = "Same college";
    else if (viewer.branch && p.branch && viewer.branch.toLowerCase() === p.branch.toLowerCase())
      reason = "Same branch";
    else if (sameCluster) reason = "In your community";
    else if (sem >= 0.7) reason = "Shares your interests";
    else if (field.sameCity) reason = "Same city";

    return { person: { ...p } as MiniProfile, reason, mutualCount: mutuals, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => ({
    ...s.person,
    reason: s.reason,
    mutualCount: s.mutualCount,
  }));
}

/**
 * For a list of user ids, return the viewer's relationship to each so that
 * Follow/Connect buttons can render the correct state (Following / Connected /
 * Pending) instead of always showing "Follow". Used by pages that render people
 * who may already be followed or connected (e.g. search / explore results).
 */
/**
 * Direction of the connection edge as seen BY THE VIEWER:
 *  - "none":             no connection row exists
 *  - "outgoing_pending": the viewer sent a request that is still pending
 *  - "incoming_pending": the OTHER person sent the viewer a request - the viewer
 *                        can Accept or Ignore it (they must never "cancel" it)
 *  - "connected":        an accepted, mutual connection
 *
 * Collapsing incoming + outgoing into one `pending` boolean is exactly what let
 * an INCOMING invite render as the viewer's own cancelable "Pending" and get
 * hard-deleted on click. Direction is derived from `connections.requested_by`.
 */
export type ConnectionDirection =
  | "none"
  | "outgoing_pending"
  | "incoming_pending"
  | "connected";

export interface RelationshipState {
  isFollowing: boolean;
  isConnected: boolean;
  /** Directional connection state - never collapses the two pending directions. */
  direction: ConnectionDirection;
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
      // requested_by is REQUIRED to tell an incoming request from an outgoing one.
      .select("user_a_id, user_b_id, status, requested_by")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .in("status", ["accepted", "pending"]),
  ]);

  const followingSet = new Set((follows ?? []).map((f) => f.following_id as string));
  const directionById = new Map<string, ConnectionDirection>();
  for (const c of conns ?? []) {
    const otherId = c.user_a_id === user.id ? (c.user_b_id as string) : (c.user_a_id as string);
    if (c.status === "accepted") {
      directionById.set(otherId, "connected");
    } else if (c.requested_by === user.id) {
      directionById.set(otherId, "outgoing_pending");
    } else {
      // Requested by the other party (or a legacy null requested_by) -> incoming,
      // so it is offered as Accept/Ignore and can never be silently destroyed.
      directionById.set(otherId, "incoming_pending");
    }
  }

  for (const id of targets) {
    const direction = directionById.get(id) ?? "none";
    out[id] = {
      isFollowing: followingSet.has(id),
      isConnected: direction === "connected",
      direction,
    };
  }
  return out;
}

// ===========================================================================
// SEARCH - ranked, prefix + typo-tolerant, via the 0027 SECURITY INVOKER RPCs.
// ===========================================================================

export interface SearchPerson {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
  branch: string | null;
  /** "Same college", "You follow them", etc. Only set when a signal applies. */
  reason?: string;
}
export interface SearchPost {
  id: string;
  short_id: string;
  body: string;
  created_at: string;
  like_count: number;
  author: { handle: string; name: string; avatar_url: string | null };
}
export interface SearchProject {
  id: string;
  short_id: string;
  title: string;
  brief: string | null;
  status: string;
}
export interface SearchHashtag {
  tag: string;
  use_count: number;
}
export interface SearchResults {
  people: SearchPerson[];
  posts: SearchPost[];
  projects: SearchProject[];
  hashtags: SearchHashtag[];
  query: string;
}

const EMPTY_RESULTS = (query: string): SearchResults => ({
  people: [],
  posts: [],
  projects: [],
  hashtags: [],
  query,
});

// In-process micro-cache so repeated identical server-action calls (rapid
// duplicate keystrokes, two tabs) are free for ~30s. Capped to 50 entries.
const SEARCH_TTL = 30_000;
const searchCache = new Map<string, { at: number; data: SearchResults }>();

/**
 * Ranked search across people / posts / projects / hashtags.
 *  - prefix matching via tsv `to_tsquery('term:*')` and typo tolerance via
 *    pg_trgm `similarity()` (both index-backed, done inside the RPCs);
 *  - people are re-ranked by viewer affinity (same college / branch / already
 *    following) with a `reason`, reusing the ranker philosophy;
 *  - posts carry their author + timestamp; projects carry status; hashtags
 *    carry the now-real use_count.
 * `compact` returns fewer rows per group (top-bar dropdown); default returns
 * more rows (the full /explore?q= results page).
 */
export async function searchAll(
  query: string,
  opts?: { compact?: boolean }
): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return EMPTY_RESULTS(q);

  const compact = opts?.compact ?? false;
  const cacheKey = `${compact ? "c" : "f"}:${q.toLowerCase()}`;
  const hit = searchCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.data;

  const sb = await getSupabaseServer();
  if (!sb) return EMPTY_RESULTS(q);

  const peopleLim = compact ? 5 : 16;
  const postsLim = compact ? 3 : 12;
  const projectsLim = compact ? 3 : 12;
  const tagsLim = compact ? 5 : 16;

  const [peopleRes, postsRes, projectsRes, hashtagsRes] = await Promise.all([
    sb.rpc("search_people", { q, lim: peopleLim }),
    sb.rpc("search_posts", { q, lim: postsLim }),
    sb.rpc("search_projects", { q, lim: projectsLim }),
    sb.rpc("search_hashtags", { q, lim: tagsLim }),
  ]);

  type PeopleRow = {
    id: string; handle: string; name: string; avatar_url: string | null;
    college: string | null; branch: string | null;
  };
  type PostRow = {
    id: string; short_id: string; body: string; created_at: string;
    like_count: number; author_handle: string; author_name: string;
    author_avatar: string | null;
  };
  type ProjectRow = {
    id: string; short_id: string; title: string; brief: string | null; status: string;
  };
  type HashtagRow = { tag: string; use_count: number };

  const peopleRows = (peopleRes.data as PeopleRow[] | null) ?? [];

  // Viewer-affinity re-rank for people (O(n) over <=16 rows). People you know
  // float up; attach a reason string ("Same college", "You follow them").
  let people: SearchPerson[] = peopleRows.map((p) => ({
    id: p.id, handle: p.handle, name: p.name, avatar_url: p.avatar_url,
    college: p.college, branch: p.branch,
  }));

  const { data: { user } } = await sb.auth.getUser();
  if (user && peopleRows.length > 0) {
    const ids = peopleRows.map((p) => p.id);
    const [{ data: me }, rel] = await Promise.all([
      sb.from("profiles").select("college, branch").eq("id", user.id).maybeSingle(),
      getRelationshipStates(ids),
    ]);
    const myCollege = (me?.college as string | null)?.toLowerCase() ?? null;
    const myBranch = (me?.branch as string | null)?.toLowerCase() ?? null;

    const ranked = peopleRows.map((p) => {
      const sameCollege = Boolean(myCollege && p.college && p.college.toLowerCase() === myCollege);
      const sameBranch = Boolean(myBranch && p.branch && p.branch.toLowerCase() === myBranch);
      const r = rel[p.id];
      let boost = 0;
      let reason: string | undefined;
      if (r?.isFollowing) { boost += 0.4; reason = "You follow them"; }
      else if (r?.isConnected) { boost += 0.5; reason = "Connected"; }
      if (sameCollege) { boost += 0.5; reason = reason ?? "Same college"; }
      else if (sameBranch) { boost += 0.3; reason = reason ?? "Same branch"; }
      return {
        person: {
          id: p.id, handle: p.handle, name: p.name, avatar_url: p.avatar_url,
          college: p.college, branch: p.branch, reason,
        } as SearchPerson,
        boost,
      };
    });
    ranked.sort((a, b) => b.boost - a.boost);
    people = ranked.map((x) => x.person);
  }

  const posts: SearchPost[] = ((postsRes.data as PostRow[] | null) ?? []).map((p) => ({
    id: p.id, short_id: p.short_id, body: p.body, created_at: p.created_at,
    like_count: p.like_count,
    author: { handle: p.author_handle, name: p.author_name, avatar_url: p.author_avatar },
  }));

  const projects: SearchProject[] = ((projectsRes.data as ProjectRow[] | null) ?? []).map((p) => ({
    id: p.id, short_id: p.short_id, title: p.title, brief: p.brief, status: p.status,
  }));

  const hashtags: SearchHashtag[] = ((hashtagsRes.data as HashtagRow[] | null) ?? []).map((h) => ({
    tag: h.tag, use_count: h.use_count,
  }));

  const result: SearchResults = { people, posts, projects, hashtags, query: q };

  searchCache.set(cacheKey, { at: Date.now(), data: result });
  if (searchCache.size > 50) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }

  return result;
}

// ===========================================================================
// TRENDING - one real source of truth (velocity + window + personalisation).
// ===========================================================================

export interface TrendingTag {
  tag: string;
  count: number;     // REAL posts-in-window count
  authors: number;   // distinct contributors (spam guard surfaced as "N people")
  velocity: number;  // 0..1 normalised acceleration vs the prior window
  rising: boolean;   // velocity above threshold -> show the rising affordance
  forYou: boolean;   // relevant to the viewer's field/interests
  score: number;     // final ranking score
}

/**
 * Real, windowed, personalised trending tags. Velocity (this window vs the
 * prior equal window) not raw count; honest in-window post count; spam-guarded
 * by distinct authors; floated toward the viewer's field via the same
 * semanticMatch + feed_events behaviour affinity the feed uses. Single source
 * of truth for both the home rail and explore.
 */
export async function getTrendingTags(limit = 8, winHours = 24): Promise<TrendingTag[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  // Viewer field context for personalisation (same sources the feed uses).
  let interests: string[] = [];
  let branch: string | null = null;
  const behaviorTags = new Map<string, number>();
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const [{ data: prof }, { data: events }] = await Promise.all([
      sb.from("profiles").select("interests, branch").eq("id", user.id).maybeSingle(),
      sb.from("feed_events")
        .select("kind, posts!inner(hashtags)")
        .eq("user_id", user.id)
        .in("kind", ["click", "expand", "save", "dwell"])
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    interests = (prof?.interests as string[]) ?? [];
    branch = (prof?.branch as string | null) ?? null;
    const W: Record<string, number> = { dwell: 1, click: 2, expand: 2, save: 4 };
    for (const e of (events ?? []) as Array<{ kind: string; posts?: { hashtags?: string[] } }>) {
      const w = W[e.kind] ?? 1;
      for (const t of e.posts?.hashtags ?? []) {
        const k = t.toLowerCase();
        behaviorTags.set(k, (behaviorTags.get(k) ?? 0) + w);
      }
    }
  }
  const maxBeh = Math.max(1, ...behaviorTags.values());
  const fieldTags = [...interests, ...(branch ? [branch] : [])];

  const { data: rows } = await sb.rpc("trending_tags", { win_hours: winHours, max_tags: limit });
  const raw = (rows ?? []) as Array<{
    tag: string; posts_window: number; posts_prior: number; authors: number; engagement: number;
  }>;
  if (raw.length === 0) return [];

  // Velocity = growth of this window over the prior window (acceleration),
  // Laplace-smoothed so a brand-new spike (prior=0) scores high but not infinite.
  const velRaw = raw.map((r) => (r.posts_window + 1) / (r.posts_prior + 1) - 1);
  const vMax = Math.max(1e-6, ...velRaw.map((v) => Math.max(0, v)));

  const scored: TrendingTag[] = raw.map((r, i) => {
    const velocity = Math.max(0, velRaw[i]) / vMax; // 0..1
    const breadth = Math.min(1, r.authors / 4);     // spam guard
    const sem = fieldTags.length ? semanticMatch(fieldTags, [r.tag]) : 0;
    const beh = (behaviorTags.get(r.tag.toLowerCase()) ?? 0) / maxBeh;
    const personal = Math.max(sem, beh);            // 0..1
    const popularity = Math.log10(r.posts_window + 1);
    const score = 0.9 * popularity + 0.8 * velocity + 0.4 * breadth + 0.6 * personal;
    return {
      tag: r.tag,
      count: r.posts_window,
      authors: r.authors,
      velocity,
      rising: velocity > 0.5 && r.posts_window >= 3,
      forYou: personal >= 0.5,
      score,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ===========================================================================
// PROJECT DISCOVERY - matched open projects for the viewer (not "newest").
// ===========================================================================

export interface SuggestedProject {
  id: string;
  short_id: string;
  title: string;
  brief: string | null;
  status: string;
  deadline: string | null;
  member_count: number;
  slot_count: number;
  open_slots: number;
  author: { handle: string; name: string; avatar_url: string | null } | null;
  reason: string;
  score: number;
}

/**
 * Real "projects for you": recall open projects, then rank by how well the
 * title/brief overlap the viewer's interests + branch (semanticMatch over the
 * expanded interest tokens), with open-slot availability and recency. Replaces
 * the single mislabelled "Featured project = newest" on explore.
 */
export async function getSuggestedProjects(limit = 6): Promise<SuggestedProject[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data: { user } } = await sb.auth.getUser();
  let interests: string[] = [];
  let branch: string | null = null;
  if (user) {
    const { data: me } = await sb
      .from("profiles").select("interests, branch").eq("id", user.id).maybeSingle();
    interests = (me?.interests as string[]) ?? [];
    branch = (me?.branch as string | null) ?? null;
  }
  const fieldTags = [...interests, ...(branch ? [branch] : [])].map((t) => t.toLowerCase());

  const { data } = await sb
    .from("projects")
    .select(
      "id, short_id, title, brief, status, deadline, slot_count, created_at, author:profiles!projects_author_id_fkey(handle,name,avatar_url), members:project_members(count)"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(40);

  type Row = {
    id: string; short_id: string; title: string; brief: string | null;
    status: string; deadline: string | null; slot_count: number; created_at: string;
    author: { handle: string; name: string; avatar_url: string | null } | null;
    members?: Array<{ count: number }>;
  };

  const rows = (data as unknown as Row[] | null) ?? [];
  if (rows.length === 0) return [];

  const ageDays = (iso: string) => Math.max((Date.now() - new Date(iso).getTime()) / 8.64e7, 0);

  const scored = rows.map((p) => {
    const memberCount = p.members?.[0]?.count ?? 0;
    const openSlots = Math.max(0, (p.slot_count ?? 0) + 1 - memberCount); // +owner
    // Tokenise title+brief; match against the viewer's expanded field tags.
    const text = `${p.title} ${p.brief ?? ""}`.toLowerCase();
    const projTokens = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
    const sem = fieldTags.length ? semanticMatch(fieldTags, projTokens) : 0;
    const slotScore = openSlots > 0 ? Math.min(1, openSlots / 4) : 0;
    const recency = Math.exp(-ageDays(p.created_at) / 14);
    const score = 0.7 * sem + 0.2 * slotScore + 0.3 * recency;

    let reason = "Open for applications";
    if (sem >= 0.7) reason = "Matches your interests";
    else if (openSlots >= 3) reason = `${openSlots} open slots`;
    else if (recency > 0.8) reason = "Just posted";

    return {
      project: {
        id: p.id, short_id: p.short_id, title: p.title, brief: p.brief,
        status: p.status, deadline: p.deadline,
        member_count: memberCount, slot_count: p.slot_count, open_slots: openSlots,
        author: p.author,
        reason, score,
      } as SuggestedProject,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.project);
}
