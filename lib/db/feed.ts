import { getSupabaseServer } from "@/lib/supabase/server";
import type { PostWithAuthor } from "@/lib/db/posts";
import { scorePost, diversifyTopK, type ScoredPost } from "@/lib/ranker/score";
import { checkContent } from "@/lib/moderation/guardrail";
import { mockPosts } from "@/lib/mockData";

const SELECT = "*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college)";

// Apply the "live" filter (not soft-deleted, not expired unless pinned/highlight)
// to a filter builder returned by .select(). Typed loosely; Supabase chained
// builders are hard to name precisely without generated DB types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function liveFilter<T extends { is: (...a: any[]) => T; or: (...a: any[]) => T }>(q: T): T {
  // not expired (or pinned/highlight) and not soft-deleted
  return q.is("deleted_at", null).or("expires_at.is.null,expires_at.gt.now()");
}

export async function getForYouFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return mockPosts as unknown as PostWithAuthor[];

  const { data: { user } } = await sb.auth.getUser();

  // Candidate pool: latest 60 live posts.
  const { data: candidates } = await liveFilter(
    sb.from("posts").select(SELECT)
  ).order("created_at", { ascending: false }).limit(60);

  let pool = (candidates as PostWithAuthor[] | null) ?? [];

  // Drop guardrail failures.
  pool = pool.filter((p) => checkContent(p.body).ok);

  // Personalisation context.
  let interests: string[] = [];
  const seenIds = new Set<string>();
  if (user) {
    const [{ data: prof }, { data: feedback }, { data: seen }] = await Promise.all([
      sb.from("profiles").select("interests").eq("id", user.id).maybeSingle(),
      sb.from("user_feed_feedback").select("post_id").eq("user_id", user.id).eq("signal", "not_interested"),
      sb.from("user_seen_posts").select("post_id").eq("user_id", user.id),
    ]);
    interests = (prof?.interests as string[]) ?? [];
    const notInterested = new Set((feedback ?? []).map((r) => r.post_id as string));
    pool = pool.filter((p) => !notInterested.has(p.id));
    for (const s of seen ?? []) seenIds.add(s.post_id as string);
  }

  const recentTags: string[] = [];
  const scored: ScoredPost[] = pool.map((p) => {
    const s = scorePost(p, { interests, seenIds, recentTags });
    const primary = p.hashtags[0]?.toLowerCase();
    if (primary) recentTags.push(primary);
    return s;
  });

  return diversifyTopK(scored, limit);
}

export async function getRecentFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return mockPosts as unknown as PostWithAuthor[];

  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const { data: follows } = await sb.from("follows").select("following_id").eq("follower_id", user.id);
    const ids = (follows ?? []).map((f) => f.following_id as string);
    if (ids.length > 0) {
      const { data } = await liveFilter(sb.from("posts").select(SELECT))
        .in("author_id", ids)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (data && data.length > 0) return data as PostWithAuthor[];
    }
  }

  // Fallback: global latest.
  const { data } = await liveFilter(sb.from("posts").select(SELECT))
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as PostWithAuthor[]) ?? (mockPosts as unknown as PostWithAuthor[]);
}

export async function getPopularFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return mockPosts as unknown as PostWithAuthor[];
  const { data } = await sb
    .from("posts")
    .select(SELECT)
    .is("deleted_at", null)
    .order("like_count", { ascending: false })
    .limit(limit);
  return (data as PostWithAuthor[]) ?? (mockPosts as unknown as PostWithAuthor[]);
}

export async function getTrendingFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return mockPosts as unknown as PostWithAuthor[];

  const { data: { user } } = await sb.auth.getUser();
  let branchTags: string[] = [];
  if (user) {
    const { data: prof } = await sb.from("profiles").select("branch, city").eq("id", user.id).maybeSingle();
    if (prof?.branch) branchTags = [prof.branch as string];
  }

  let q = liveFilter(sb.from("posts").select(SELECT))
    .gte("created_at", new Date(Date.now() - 6 * 3.6e6).toISOString());
  if (branchTags.length > 0) q = q.overlaps("branch_tags", branchTags);

  const { data } = await q.order("repost_count", { ascending: false }).limit(limit);
  if (data && data.length > 0) return data as PostWithAuthor[];

  // Fallback unfiltered.
  return getPopularFeed(limit);
}
