import { getSupabaseServer } from "@/lib/supabase/server";
import { attachReposts, type PostWithAuthor } from "@/lib/db/posts";
import { scorePost, diversifyTopK, type ScoredPost, type RankerWeights } from "@/lib/ranker/score";
import { checkContent } from "@/lib/moderation/guardrail";
import { expandTagList } from "@/lib/ranker/taxonomy";

// Self-referential repost originals are resolved by attachReposts() (a batched
// second query) — PostgREST cannot embed posts->posts by FK hint.
// Author cohort fields (college/branch/city/year) drive field/location matching.
const SELECT =
  "*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college,branch,city,year_of_study,verified)";

// Live filter: not soft-deleted, not expired (unless pinned/highlight keep null).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function liveFilter<T extends { is: (...a: any[]) => T; or: (...a: any[]) => T }>(q: T): T {
  return q.is("deleted_at", null).or("expires_at.is.null,expires_at.gt.now()");
}

function engagementScore(p: PostWithAuthor): number {
  const impr = (p as PostWithAuthor & { impressions?: number }).impressions ?? 30;
  return (p.like_count + 2 * p.comment_count + 3 * p.repost_count + 4 * p.bookmark_count) / (impr + 10);
}

// Build an OR tsquery from the user's interests + branch (sanitised). Empty -> null.
function buildInterestTsQuery(interests: string[], branch?: string | null): string | null {
  const terms = [...interests, branch ?? ""]
    .flatMap((t) => t.split(/\s+/))
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 3);
  if (terms.length === 0) return null;
  return [...new Set(terms)].join(" | ");
}

/**
 * For You — the classical feed engine.
 * Recall (follows + interest/branch overlap + recent) -> BM25/FTS relevancy ->
 * MCDM Tchebycheff scoring -> greedy diversity. Honours feed_prefs + feedback.
 */
export async function getForYouFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data: { user } } = await sb.auth.getUser();

  // Personalisation context.
  let interests: string[] = [];
  let branch: string | null = null;
  let viewer: { college?: string | null; branch?: string | null; year?: string | null; city?: string | null } = {};
  let onlyFollows = false;
  let hideProjects = false;
  let followIds: string[] = [];
  let cohortAuthorIds: string[] = [];
  const seenIds = new Set<string>();
  const notInterested = new Set<string>();
  let blockedIds: string[] = [];
  const behaviorAffinity = new Map<string, number>(); // tag -> revealed preference
  let learnedWeights: RankerWeights | undefined;

  if (user) {
    const [{ data: prof }, { data: feedback }, { data: seen }, { data: follows }, { data: blockRows }, { data: events }, { data: rw }] =
      await Promise.all([
        sb.from("profiles").select("interests, branch, college, city, year_of_study, feed_prefs").eq("id", user.id).maybeSingle(),
        sb.from("user_feed_feedback").select("post_id").eq("user_id", user.id).eq("signal", "not_interested"),
        sb.from("user_seen_posts").select("post_id").eq("user_id", user.id),
        sb.from("follows").select("following_id").eq("follower_id", user.id),
        sb.from("blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
        // Behavioural fuel: tags of posts the viewer actively engaged with.
        sb.from("feed_events").select("post_id, kind, posts!inner(hashtags)").eq("user_id", user.id).in("kind", ["click", "expand", "save", "dwell"]).order("created_at", { ascending: false }).limit(500),
        sb.from("ranker_weights").select("weights, n_samples").eq("id", 1).maybeSingle(),
      ]);
    interests = (prof?.interests as string[]) ?? [];
    branch = (prof?.branch as string | null) ?? null;
    viewer = {
      college: (prof?.college as string | null) ?? null,
      branch,
      year: (prof?.year_of_study as string | null) ?? null,
      city: (prof?.city as string | null) ?? null,
    };
    const fp = (prof?.feed_prefs as { only_follows?: boolean; hide_projects?: boolean } | null) ?? null;
    onlyFollows = Boolean(fp?.only_follows);
    hideProjects = Boolean(fp?.hide_projects);
    followIds = (follows ?? []).map((f) => f.following_id as string);
    if (onlyFollows && followIds.length === 0) return [];
    for (const f of feedback ?? []) notInterested.add(f.post_id as string);
    for (const s of seen ?? []) seenIds.add(s.post_id as string);
    blockedIds = (blockRows ?? []).map((r) =>
      r.blocker_id === user.id ? (r.blocked_id as string) : (r.blocker_id as string)
    );

    // Revealed preference: weight tags by how much the viewer engaged (recency-decayed),
    // then normalise 0..1. This is "what you DO", which the scorer trusts highly.
    const tagCounts = new Map<string, number>();
    const W: Record<string, number> = { dwell: 1, click: 2, expand: 2, save: 4 };
    for (const e of (events ?? []) as Array<{ kind: string; posts?: { hashtags?: string[] } }>) {
      const w = W[e.kind] ?? 1;
      for (const t of e.posts?.hashtags ?? []) tagCounts.set(t.toLowerCase(), (tagCounts.get(t.toLowerCase()) ?? 0) + w);
    }
    const maxTag = Math.max(1, ...tagCounts.values());
    for (const [t, c] of tagCounts) behaviorAffinity.set(t, c / maxTag);

    // Learned weights from the nightly fit job (only once it has enough samples).
    const wj = rw?.weights as RankerWeights | undefined;
    if (wj && (rw?.n_samples ?? 0) >= 200 && typeof wj.match === "number") learnedWeights = wj;

    // Cohort authors (same college or branch) for "people like me" recall.
    if (viewer.college || branch) {
      let q = sb.from("profiles").select("id").neq("id", user.id).is("deleted_at", null).is("suspended_at", null).limit(200);
      if (viewer.college) q = q.eq("college", viewer.college);
      const { data: cohort } = await q;
      cohortAuthorIds = (cohort ?? []).map((c) => c.id as string);
    }
  }

  // RECALL: union of recent global + interest/branch-tag overlap (+ follows).
  const byId = new Map<string, PostWithAuthor>();
  const addAll = (rows: PostWithAuthor[] | null) => {
    for (const r of rows ?? []) byId.set(r.id, r);
  };

  if (onlyFollows && followIds.length > 0) {
    const { data } = await liveFilter(sb.from("posts").select(SELECT))
      .in("author_id", followIds)
      .order("created_at", { ascending: false })
      .limit(80);
    addAll(data as PostWithAuthor[] | null);
  } else {
    // Semantic recall: expand the viewer's interests to RELATED tags via the
    // taxonomy (so "AI/ML" also recalls #llm / #deeplearning), capped for the query.
    const expanded = expandTagList([...interests, ...(branch ? [branch] : [])]).slice(0, 60);
    const queries: PromiseLike<unknown>[] = [
      liveFilter(sb.from("posts").select(SELECT)).order("created_at", { ascending: false }).limit(60),
    ];
    if (expanded.length > 0) {
      queries.push(
        liveFilter(sb.from("posts").select(SELECT)).overlaps("hashtags", expanded).order("created_at", { ascending: false }).limit(50)
      );
      if (branch) {
        queries.push(
          liveFilter(sb.from("posts").select(SELECT)).overlaps("branch_tags", [branch]).order("created_at", { ascending: false }).limit(40)
        );
      }
    }
    if (followIds.length > 0) {
      queries.push(
        liveFilter(sb.from("posts").select(SELECT)).in("author_id", followIds).order("created_at", { ascending: false }).limit(40)
      );
    }
    // Cohort recall: recent posts from people in your college/branch ("like me").
    if (cohortAuthorIds.length > 0) {
      queries.push(
        liveFilter(sb.from("posts").select(SELECT)).in("author_id", cohortAuthorIds.slice(0, 150)).order("created_at", { ascending: false }).limit(40)
      );
    }
    const results = (await Promise.all(queries)) as Array<{ data: PostWithAuthor[] | null }>;
    for (const r of results) addAll(r.data);
  }

  let pool = [...byId.values()];

  // Filters: blocked, not-interested, guardrail, hide-projects pref.
  const blockedSet = new Set(blockedIds);
  pool = pool.filter(
    (p) =>
      !blockedSet.has(p.author_id) &&
      !notInterested.has(p.id) &&
      checkContent(p.body).ok &&
      !(hideProjects && (p as { project_id?: string | null }).project_id)
  );
  if (pool.length === 0) return [];

  // BM25/FTS relevancy: which candidates match the user's interest tsquery.
  const relevancy = new Map<string, number>();
  const tsq = buildInterestTsQuery(interests, branch);
  if (tsq && pool.length > 0) {
    const { data: matched } = await sb
      .from("posts")
      .select("id")
      .in("id", pool.map((p) => p.id))
      .textSearch("search_tsv", tsq);
    for (const m of matched ?? []) relevancy.set(m.id as string, 1);
  }

  // Item-based Collaborative Filtering (live, bounded, classical): people who
  // liked what I liked also liked X -> boost X. Pure co-occurrence counts.
  const cf = new Map<string, number>();
  const ppr = new Map<string, number>();
  if (user) {
    const { data: myLikes } = await sb.from("likes").select("post_id").eq("user_id", user.id).limit(100);
    const myLikedIds = (myLikes ?? []).map((r) => r.post_id as string);
    if (myLikedIds.length > 0) {
      const { data: coLikers } = await sb
        .from("likes").select("user_id").in("post_id", myLikedIds).neq("user_id", user.id).limit(800);
      const coSet = [...new Set((coLikers ?? []).map((r) => r.user_id as string))].slice(0, 400);
      if (coSet.length > 0) {
        const { data: coLiked } = await sb.from("likes").select("post_id").in("user_id", coSet).limit(2000);
        const counts = new Map<string, number>();
        for (const r of coLiked ?? []) counts.set(r.post_id as string, (counts.get(r.post_id as string) ?? 0) + 1);
        const max = Math.max(1, ...counts.values());
        for (const [pid, c] of counts) cf.set(pid, c / max);
      }
    }
    // Personalised PageRank (approx, network science): 1st degree = 1.0, 2nd = 0.5.
    for (const f of followIds) ppr.set(f, 1.0);
    if (followIds.length > 0) {
      const { data: second } = await sb.from("follows").select("following_id").in("follower_id", followIds).limit(2000);
      for (const r of second ?? []) {
        const a = r.following_id as string;
        if (!ppr.has(a)) ppr.set(a, 0.5);
      }
    }
  }

  // Velocity ("hot right now"): engagement of posts younger than 6h, normalised.
  // The freshness/virality signal — what's accelerating in the last few hours.
  const velocity = new Map<string, number>();
  const fresh = pool.filter((p) => (Date.now() - new Date(p.created_at).getTime()) / 3.6e6 < 6);
  if (fresh.length > 0) {
    const vmax = Math.max(1e-6, ...fresh.map(engagementScore));
    for (const p of fresh) velocity.set(p.id, engagementScore(p) / vmax);
  }

  // Score (MCDM Tchebycheff over semantic + field + behavioural + graph signals).
  const recentTags: string[] = [];
  const scored: ScoredPost[] = pool.map((p) => {
    const s = scorePost(p, {
      interests, branch, seenIds, recentTags, relevancy, cf, ppr,
      viewer, behaviorAffinity, velocity, weights: learnedWeights,
    });
    const primary = p.hashtags?.[0]?.toLowerCase();
    if (primary) recentTags.push(primary);
    return s;
  });

  return attachReposts(sb, diversifyTopK(scored, limit));
}

/** Recent — reverse-chronological from people you follow. Empty if no follows. */
export async function getRecentFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data: follows } = await sb.from("follows").select("following_id").eq("follower_id", user.id);
  const ids = (follows ?? []).map((f) => f.following_id as string);
  if (ids.length === 0) return [];
  const { data } = await liveFilter(sb.from("posts").select(SELECT))
    .in("author_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  return attachReposts(sb, (data as unknown as PostWithAuthor[]) ?? []);
}

/** Popular — last 24h, ranked by engagement-per-impression. */
export async function getPopularFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const since = new Date(Date.now() - 24 * 3.6e6).toISOString();
  const { data } = await liveFilter(sb.from("posts").select(SELECT))
    .gte("created_at", since)
    .limit(120);
  const rows = (data as unknown as PostWithAuthor[]) ?? [];
  return attachReposts(sb, rows.sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, limit));
}

/** Trending — last 6h, branch+city boosted, ranked by recent engagement. */
export async function getTrendingFeed(limit = 12): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  let branch: string | null = null;
  let city: string | null = null;
  if (user) {
    const { data: prof } = await sb.from("profiles").select("branch, city").eq("id", user.id).maybeSingle();
    branch = (prof?.branch as string | null) ?? null;
    city = (prof?.city as string | null) ?? null;
  }
  const since = new Date(Date.now() - 6 * 3.6e6).toISOString();
  const { data } = await liveFilter(sb.from("posts").select(SELECT))
    .gte("created_at", since)
    .limit(120);
  let rows = (data as unknown as PostWithAuthor[]) ?? [];
  if (rows.length === 0) return getPopularFeed(limit);

  const boost = (p: PostWithAuthor) => {
    let b = engagementScore(p);
    if (branch && (p.branch_tags ?? []).some((t) => t.toLowerCase() === branch!.toLowerCase())) b += 0.5;
    if (city && (p.city_tags ?? []).some((t) => t.toLowerCase() === city!.toLowerCase())) b += 0.3;
    return b;
  };
  rows = rows.sort((a, b) => boost(b) - boost(a)).slice(0, limit);
  return attachReposts(sb, rows);
}
