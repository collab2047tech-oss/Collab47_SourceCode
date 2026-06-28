import { getSupabaseServer } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Creator analytics - 100% real, derived from logged data. NOTHING stubbed.
//   - per-post impressions  : posts.impressions (bumped by bump_impressions)
//   - engagement counts     : posts.{like,comment,repost,bookmark}_count (triggers)
//   - daily reach           : creator_impressions_daily() RPC over feed_events
//   - profile views         : profile_views table (record_profile_view RPC)
//   - followers/connections : follows / connections rows (real, with created_at)
// The engagementScore shown per post is the SAME Bayesian rate the feed ranker
// uses (lib/db/feed.ts engagementScore): eng / (impressions + 20).
// ---------------------------------------------------------------------------

export interface PostPerf {
  id: string;
  short_id: string;
  body: string;
  created_at: string;
  impressions: number;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  /** weighted engagements / impressions, capped 0..1 for display */
  engagementRate: number;
  /** the exact ranker score (Bayesian shrink) this post gets in the feed */
  rankerScore: number;
}

export interface ProfileViewer {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  college: string | null;
  viewed_at: string;
}

export interface CreatorAnalytics {
  totals: {
    posts: number;
    impressions: number;
    engagements: number;
    engagementRate: number; // weighted engagements / impressions
    followers: number;
    connections: number;
    newFollowers30d: number;
    profileViews30d: number;
    profileViewsTotal: number;
  };
  impressionsDaily: { day: string; impressions: number }[];
  engagementsDaily: { day: string; engagements: number }[];
  topPosts: PostPerf[];
  recentViewers: ProfileViewer[];
}

const WEIGHTED = (l: number, c: number, r: number, b: number) => l + 2 * c + 3 * r + 4 * b;
// Mirror lib/db/feed.ts engagementScore Bayesian prior so the number the creator
// sees is the number the ranker actually uses.
const rankerScore = (eng: number, impr: number) => eng / (impr + 20);

const EMPTY: CreatorAnalytics = {
  totals: { posts: 0, impressions: 0, engagements: 0, engagementRate: 0, followers: 0, connections: 0, newFollowers30d: 0, profileViews30d: 0, profileViewsTotal: 0 },
  impressionsDaily: [],
  engagementsDaily: [],
  topPosts: [],
  recentViewers: [],
};

export async function getCreatorAnalytics(): Promise<CreatorAnalytics> {
  const sb = await getSupabaseServer();
  if (!sb) return EMPTY;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return EMPTY;
  const uid = user.id;
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [postsRes, impDaily, engDaily, followersRes, connsRes, newFollowersRes, viewsRows] = await Promise.all([
    sb.from("posts")
      .select("id, short_id, body, created_at, impressions, like_count, comment_count, repost_count, bookmark_count")
      .eq("author_id", uid).is("deleted_at", null)
      .order("impressions", { ascending: false }).limit(500),
    sb.rpc("creator_impressions_daily", { days: 30 }),
    sb.rpc("creator_engagements_daily", { days: 30 }),
    sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", uid),
    sb.from("connections").select("user_a_id", { count: "exact", head: true }).eq("status", "accepted").or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`),
    sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", uid).gte("created_at", since30),
    sb.from("profile_views").select("viewer_id, viewed_at, viewed_on").eq("profile_id", uid).order("viewed_at", { ascending: false }).limit(200),
  ]);

  const posts = (postsRes.data as Array<{
    id: string; short_id: string; body: string; created_at: string; impressions: number;
    like_count: number; comment_count: number; repost_count: number; bookmark_count: number;
  }> | null) ?? [];

  let impressions = 0;
  let engagements = 0;
  const perf: PostPerf[] = posts.map((p) => {
    const impr = p.impressions ?? 0;
    const likes = p.like_count ?? 0, comments = p.comment_count ?? 0, reposts = p.repost_count ?? 0, saves = p.bookmark_count ?? 0;
    const w = WEIGHTED(likes, comments, reposts, saves);
    impressions += impr;
    engagements += w;
    return {
      id: p.id, short_id: p.short_id, body: p.body, created_at: p.created_at,
      impressions: impr, likes, comments, reposts, saves,
      engagementRate: impr > 0 ? Math.min(1, w / impr) : 0,
      rankerScore: rankerScore(w, impr),
    };
  });

  // Recent viewers: distinct latest viewer, resolved to public profile info.
  const views = (viewsRows.data as Array<{ viewer_id: string; viewed_at: string; viewed_on: string }> | null) ?? [];
  const profileViewsTotal = views.length;
  const profileViews30d = views.filter((v) => v.viewed_at >= since30).length;
  const seen = new Set<string>();
  const distinctViewerIds: { id: string; viewed_at: string }[] = [];
  for (const v of views) {
    if (seen.has(v.viewer_id)) continue;
    seen.add(v.viewer_id);
    distinctViewerIds.push({ id: v.viewer_id, viewed_at: v.viewed_at });
  }
  const topViewerIds = distinctViewerIds.slice(0, 12);
  let recentViewers: ProfileViewer[] = [];
  if (topViewerIds.length > 0) {
    const { data: profs } = await sb
      .from("profiles")
      .select("id, name, handle, avatar_url, college")
      .in("id", topViewerIds.map((v) => v.id));
    const byId = new Map((profs ?? []).map((p) => [p.id as string, p]));
    recentViewers = topViewerIds
      .map((v) => {
        const p = byId.get(v.id);
        if (!p) return null;
        return {
          id: p.id as string, name: p.name as string, handle: p.handle as string,
          avatar_url: (p.avatar_url as string | null) ?? null, college: (p.college as string | null) ?? null,
          viewed_at: v.viewed_at,
        } satisfies ProfileViewer;
      })
      .filter((x): x is ProfileViewer => x !== null);
  }

  const topPosts = [...perf].sort((a, b) => b.impressions - a.impressions || b.engagementRate - a.engagementRate).slice(0, 6);

  return {
    totals: {
      posts: posts.length,
      impressions,
      engagements,
      engagementRate: impressions > 0 ? engagements / impressions : 0,
      followers: followersRes.count ?? 0,
      connections: connsRes.count ?? 0,
      newFollowers30d: newFollowersRes.count ?? 0,
      profileViews30d,
      profileViewsTotal,
    },
    impressionsDaily: ((impDaily.data as Array<{ day: string; impressions: number }> | null) ?? []).map((d) => ({ day: d.day, impressions: Number(d.impressions) })),
    engagementsDaily: ((engDaily.data as Array<{ day: string; engagements: number }> | null) ?? []).map((d) => ({ day: d.day, engagements: Number(d.engagements) })),
    topPosts,
    recentViewers,
  };
}
