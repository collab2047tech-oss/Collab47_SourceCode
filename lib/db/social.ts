import { getSupabaseServer } from "@/lib/supabase/server";
import { mockPeople } from "@/lib/mockData";

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

const MOCK_PEOPLE: MiniProfile[] = mockPeople.map((p, i) => ({
  id: `mock-${i}`,
  handle: p.handle,
  name: p.name,
  avatar_url: null,
  college: p.college,
  branch: p.role,
}));

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

export async function followUser(targetUserId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
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
  const { error } = await sb.from("connections").insert({ user_a_id: a, user_b_id: b, status: "pending" });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
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
  if (!sb) return MOCK_PEOPLE;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return MOCK_PEOPLE;

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

export async function getSuggestedConnections(limit = 10): Promise<MiniProfile[]> {
  const sb = await getSupabaseServer();
  if (!sb) return MOCK_PEOPLE;
  const { data: { user } } = await sb.auth.getUser();
  const cols = "id, handle, name, avatar_url, college, branch";

  if (user) {
    const { data: me } = await sb.from("profiles").select("college, branch, cluster_id").eq("id", user.id).maybeSingle();
    if (me?.college) {
      const { data } = await sb
        .from("profiles")
        .select(cols)
        .eq("college", me.college)
        .neq("id", user.id)
        .is("deleted_at", null)
        .limit(limit);
      if (data && data.length > 0) return data as MiniProfile[];
    }
  }

  const { data } = await sb.from("profiles").select(cols).is("deleted_at", null).limit(limit);
  return (data as MiniProfile[]) ?? MOCK_PEOPLE;
}

export async function searchAll(query: string, limit = 20) {
  const sb = await getSupabaseServer();
  const q = query.trim();
  if (!sb || !q) return { people: [], posts: [], projects: [], hashtags: [] };

  const tsq = q.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean).join(" & ");

  const [people, posts, projects, hashtags] = await Promise.all([
    sb.from("profiles").select("id, handle, name, avatar_url, college, branch").textSearch("search_tsv", tsq).limit(limit),
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
