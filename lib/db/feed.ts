import { getSupabaseServer } from "@/lib/supabase/server";
import { attachReposts, type PostWithAuthor } from "@/lib/db/posts";
import { scorePost, diversifyTopK, type ScoredPost, type RankerWeights, type ScoreContext } from "@/lib/ranker/score";
import { checkContent } from "@/lib/moderation/guardrail";
import { expandTagList } from "@/lib/ranker/taxonomy";
import { extractFeatures, N_FEATURES } from "@/lib/ranker/features";
import { isValidModel, type RankerModel } from "@/lib/ranker/model";

// Self-referential repost originals are resolved by attachReposts() (a batched
// second query) - PostgREST cannot embed posts->posts by FK hint.
// Author cohort fields (college/branch/city/year) drive field/location matching.
const SELECT =
  "*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college,branch,city,year_of_study,verified)";

// Live filter: not soft-deleted, not expired (unless pinned/highlight keep null).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function liveFilter<T extends { is: (...a: any[]) => T; or: (...a: any[]) => T }>(q: T): T {
  return q.is("deleted_at", null).or("expires_at.is.null,expires_at.gt.now()");
}

/**
 * Engagement rate with Bayesian/Laplace shrink.
 *
 * eng = weighted reactions/comments/reposts/saves; impr = real reach (0 when
 * never recorded). The +C prior regresses low-reach posts toward 0 so a post
 * with 1 like and 0 measured impressions does NOT out-rank a post seen by 500
 * people. This removes the old magic `?? 30` that inflated unseen posts.
 */
function engagementScore(p: PostWithAuthor): number {
  const eng = p.like_count + 2 * p.comment_count + 3 * p.repost_count + 4 * p.bookmark_count;
  const impr = (p as PostWithAuthor & { impressions?: number }).impressions ?? 0;
  const C = 20; // smoothing prior: until ~20 impressions, regress toward 0
  return eng / (impr + C);
}

/** Raw engagement count (used for Popular's minimum-signal floor). */
function rawEngagement(p: PostWithAuthor): number {
  return p.like_count + p.comment_count + p.repost_count + p.bookmark_count;
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

// ---------------------------------------------------------------------------
// Feed preferences + shared post-filters (honoured by EVERY tab)
// ---------------------------------------------------------------------------

export interface FeedPrefs {
  only_follows: boolean;
  hide_projects: boolean;
}

/** Apply hide_projects (and any future content prefs) to a ranked pool. */
function applyPrefs(posts: PostWithAuthor[], prefs: FeedPrefs): PostWithAuthor[] {
  if (!prefs.hide_projects) return posts;
  return posts.filter((p) => !(p as { project_id?: string | null }).project_id);
}

// ---------------------------------------------------------------------------
// Pagination contract
// ---------------------------------------------------------------------------

export type FeedTab = "foryou" | "recent" | "popular" | "trending";

export interface FeedPage {
  posts: PostWithAuthor[];
  /** Opaque cursor for the next page; null = exhausted. */
  nextCursor: string | null;
}

export interface FeedPageOptions {
  cursor?: string | null;
  limit?: number;
  prefs?: FeedPrefs;
  /** Post ids already on screen - excluded from the next For-You page. */
  excludeIds?: string[];
}

/**
 * Single paginated entry point. The client has ONE server action that calls
 * this; it dispatches per tab and returns a uniform { posts, nextCursor }.
 */
export async function getFeedPage(tab: FeedTab, opts: FeedPageOptions = {}): Promise<FeedPage> {
  const limit = opts.limit ?? 12;
  const prefs: FeedPrefs = opts.prefs ?? { only_follows: false, hide_projects: false };
  switch (tab) {
    case "recent":
      return getRecentFeedPage({ before: opts.cursor ?? null, limit, prefs });
    case "popular":
      return getPopularFeedPage({ offset: cursorToOffset(opts.cursor), limit, prefs });
    case "trending":
      return getTrendingFeedPage({ offset: cursorToOffset(opts.cursor), limit, prefs });
    case "foryou":
    default:
      return getForYouFeedPage({ excludeIds: opts.excludeIds ?? [], limit, prefs });
  }
}

function cursorToOffset(cursor?: string | null): number {
  const n = cursor ? parseInt(cursor, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------
// Public feed functions.
// Overloaded for backward compatibility: passing a plain `limit: number`
// returns just the post array (legacy callers e.g. explore); passing an options
// object (or nothing) returns a paginated { posts, nextCursor }.
// ---------------------------------------------------------------------------

export async function getForYouFeed(limit: number): Promise<PostWithAuthor[]>;
export async function getForYouFeed(opts?: { excludeIds?: string[]; limit?: number; prefs?: FeedPrefs }): Promise<FeedPage>;
export async function getForYouFeed(arg?: number | { excludeIds?: string[]; limit?: number; prefs?: FeedPrefs }) {
  if (typeof arg === "number") return (await getForYouFeedPage({ limit: arg })).posts;
  return getForYouFeedPage(arg);
}

export async function getRecentFeed(limit: number): Promise<PostWithAuthor[]>;
export async function getRecentFeed(opts?: { before?: string | null; limit?: number; prefs?: FeedPrefs }): Promise<FeedPage>;
export async function getRecentFeed(arg?: number | { before?: string | null; limit?: number; prefs?: FeedPrefs }) {
  if (typeof arg === "number") return (await getRecentFeedPage({ limit: arg })).posts;
  return getRecentFeedPage(arg);
}

export async function getPopularFeed(limit: number): Promise<PostWithAuthor[]>;
export async function getPopularFeed(opts?: { offset?: number; limit?: number; prefs?: FeedPrefs }): Promise<FeedPage>;
export async function getPopularFeed(arg?: number | { offset?: number; limit?: number; prefs?: FeedPrefs }) {
  if (typeof arg === "number") return (await getPopularFeedPage({ limit: arg })).posts;
  return getPopularFeedPage(arg);
}

export async function getTrendingFeed(limit: number): Promise<PostWithAuthor[]>;
export async function getTrendingFeed(opts?: { offset?: number; limit?: number; prefs?: FeedPrefs }): Promise<FeedPage>;
export async function getTrendingFeed(arg?: number | { offset?: number; limit?: number; prefs?: FeedPrefs }) {
  if (typeof arg === "number") return (await getTrendingFeedPage({ limit: arg })).posts;
  return getTrendingFeedPage(arg);
}

/**
 * For You - the classical feed engine.
 * Recall (follows + interest/branch overlap + recent) -> BM25/FTS relevancy ->
 * MCDM Tchebycheff scoring -> greedy diversity. Honours feed_prefs + feedback.
 *
 * Pagination: re-ranks fresh on each page, excluding ids already on screen
 * (`excludeIds`) so pages are deduped without a fragile keyset on a JS score.
 */
async function getForYouFeedPage(opts: { excludeIds?: string[]; limit?: number; prefs?: FeedPrefs } = {}): Promise<FeedPage> {
  const limit = opts.limit ?? 12;
  const excludeIds = opts.excludeIds ?? [];
  const prefOverride = opts.prefs;
  const sb = await getSupabaseServer();
  if (!sb) return { posts: [], nextCursor: null };

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
  let model: RankerModel | undefined; // trained neural ranker (when active + valid)

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
    onlyFollows = prefOverride ? prefOverride.only_follows : Boolean(fp?.only_follows);
    hideProjects = prefOverride ? prefOverride.hide_projects : Boolean(fp?.hide_projects);
    followIds = (follows ?? []).map((f) => f.following_id as string);
    if (onlyFollows && followIds.length === 0) return { posts: [], nextCursor: null };
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

    // Trained NEURAL ranker - only used if it's marked active AND validates.
    const { data: mdl } = await sb.from("ranker_model").select("model, active, n_features").eq("id", 1).maybeSingle();
    if (mdl?.active && mdl.n_features === N_FEATURES && isValidModel(mdl.model, N_FEATURES)) {
      model = mdl.model as RankerModel;
    }

    // Cohort authors (same college or branch) for "people like me" recall.
    if (viewer.college || branch) {
      let q = sb.from("profiles").select("id").neq("id", user.id).is("deleted_at", null).is("suspended_at", null).limit(200);
      if (viewer.college) q = q.eq("college", viewer.college);
      const { data: cohort } = await q;
      cohortAuthorIds = (cohort ?? []).map((c) => c.id as string);
    }
  } else if (prefOverride) {
    onlyFollows = prefOverride.only_follows;
    hideProjects = prefOverride.hide_projects;
  }

  // Already-served ids (this page must exclude them so infinite scroll dedupes).
  const excludeSet = new Set(excludeIds);

  // RECALL: union of recent global + interest/branch-tag overlap (+ follows).
  const byId = new Map<string, PostWithAuthor>();
  const addAll = (rows: PostWithAuthor[] | null) => {
    for (const r of rows ?? []) if (!excludeSet.has(r.id)) byId.set(r.id, r);
  };

  // The recall window must GROW with scroll depth (how many ids are already on
  // screen), otherwise a fixed newest-N window starves after one page and the
  // feed dead-ends even though hundreds of older posts exist. depth scales every
  // recall query so older posts keep entering as the viewer scrolls (capped).
  const depth = excludeIds.length;
  const grow = (base: number, cap: number) => Math.min(cap, base + depth + Math.floor(depth / 2));

  if (onlyFollows && followIds.length > 0) {
    const { data } = await liveFilter(sb.from("posts").select(SELECT))
      .in("author_id", followIds)
      .order("created_at", { ascending: false })
      .limit(grow(120, 600));
    addAll(data as PostWithAuthor[] | null);
  } else {
    // Semantic recall: expand the viewer's interests to RELATED tags via the
    // taxonomy (so "AI/ML" also recalls #llm / #deeplearning), capped for the query.
    const expanded = expandTagList([...interests, ...(branch ? [branch] : [])]).slice(0, 60);
    const queries: PromiseLike<unknown>[] = [
      // Global recency backbone - the main source for viewers who follow nobody.
      liveFilter(sb.from("posts").select(SELECT)).order("created_at", { ascending: false }).limit(grow(120, 600)),
    ];
    if (expanded.length > 0) {
      queries.push(
        liveFilter(sb.from("posts").select(SELECT)).overlaps("hashtags", expanded).order("created_at", { ascending: false }).limit(grow(80, 300))
      );
      if (branch) {
        queries.push(
          liveFilter(sb.from("posts").select(SELECT)).overlaps("branch_tags", [branch]).order("created_at", { ascending: false }).limit(grow(60, 200))
        );
      }
    }
    if (followIds.length > 0) {
      queries.push(
        liveFilter(sb.from("posts").select(SELECT)).in("author_id", followIds).order("created_at", { ascending: false }).limit(grow(60, 200))
      );
    }
    // Cohort recall: recent posts from people in your college/branch ("like me").
    if (cohortAuthorIds.length > 0) {
      queries.push(
        liveFilter(sb.from("posts").select(SELECT)).in("author_id", cohortAuthorIds.slice(0, 150)).order("created_at", { ascending: false }).limit(grow(60, 200))
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
  if (pool.length === 0) return { posts: [], nextCursor: null };

  // BM25/FTS relevancy, item-based CF, and Personalised PageRank are three
  // INDEPENDENT signal sources. The FTS match (on the pool ids) and the PPR
  // second-degree fetch don't depend on each other or on the CF chain; the CF
  // chain is internally sequential (my-likes -> co-likers -> co-liked) but can
  // run concurrently with the other two. Run all three at once.
  const relevancy = new Map<string, number>();
  const cf = new Map<string, number>();
  const ppr = new Map<string, number>();
  const tsq = buildInterestTsQuery(interests, branch);

  // PPR first hop is pure JS (no query) - seed it before the concurrent fetch.
  if (user) {
    for (const f of followIds) ppr.set(f, 1.0);
  }

  const ftsMatch = async () => {
    if (!tsq || pool.length === 0) return;
    const { data: matched } = await sb
      .from("posts")
      .select("id")
      .in("id", pool.map((p) => p.id))
      .textSearch("search_tsv", tsq);
    for (const m of matched ?? []) relevancy.set(m.id as string, 1);
  };

  // Item-based Collaborative Filtering (live, bounded, classical): people who
  // liked what I liked also liked X -> boost X. Pure co-occurrence counts.
  const cfChain = async () => {
    if (!user) return;
    const { data: myLikes } = await sb.from("likes").select("post_id").eq("user_id", user.id).limit(100);
    const myLikedIds = (myLikes ?? []).map((r) => r.post_id as string);
    if (myLikedIds.length === 0) return;
    const { data: coLikers } = await sb
      .from("likes").select("user_id").in("post_id", myLikedIds).neq("user_id", user.id).limit(800);
    const coSet = [...new Set((coLikers ?? []).map((r) => r.user_id as string))].slice(0, 400);
    if (coSet.length === 0) return;
    const { data: coLiked } = await sb.from("likes").select("post_id").in("user_id", coSet).limit(2000);
    const counts = new Map<string, number>();
    for (const r of coLiked ?? []) counts.set(r.post_id as string, (counts.get(r.post_id as string) ?? 0) + 1);
    const max = Math.max(1, ...counts.values());
    for (const [pid, c] of counts) cf.set(pid, c / max);
  };

  // Personalised PageRank (approx, network science): 1st degree = 1.0, 2nd = 0.5.
  const pprFetch = async () => {
    if (!user || followIds.length === 0) return;
    const { data: second } = await sb.from("follows").select("following_id").in("follower_id", followIds).limit(2000);
    for (const r of second ?? []) {
      const a = r.following_id as string;
      if (!ppr.has(a)) ppr.set(a, 0.5);
    }
  };

  await Promise.all([ftsMatch(), cfChain(), pprFetch()]);

  // Velocity ("hot right now"): engagement of posts younger than 6h, normalised.
  // The freshness/virality signal - what's accelerating in the last few hours.
  const velocity = new Map<string, number>();
  const fresh = pool.filter((p) => (Date.now() - new Date(p.created_at).getTime()) / 3.6e6 < 6);
  if (fresh.length > 0) {
    const vmax = Math.max(1e-6, ...fresh.map(engagementScore));
    for (const p of fresh) velocity.set(p.id, engagementScore(p) / vmax);
  }

  // Score: NEURAL ranker when active, else the MCDM cold-start engine.
  const recentTags: string[] = [];
  const ctx: ScoreContext = {
    interests, branch, seenIds, recentTags, relevancy, cf, ppr,
    viewer, behaviorAffinity, velocity, weights: learnedWeights, model,
  };
  const scored: ScoredPost[] = pool.map((p) => {
    const s = scorePost(p, ctx);
    const primary = p.hashtags?.[0]?.toLowerCase();
    if (primary) recentTags.push(primary);
    return s;
  });

  const served = diversifyTopK(scored, limit);

  // Capture the served feature vectors as TRAINING DATA (the model learns from
  // these joined with the impression/engagement events). Fire-and-forget.
  if (user && served.length > 0) {
    const rows = served.map((p) => ({
      user_id: user.id,
      post_id: p.id,
      features: extractFeatures(p, ctx).values,
    }));
    void sb.from("feed_training").insert(rows);
  }

  const posts = await attachReposts(sb, served);
  // Keep paginating as long as this page yielded posts AND the recall pool held
  // more than we served (i.e. older/unseen posts remain). NOT gated on a full
  // page of exactly `limit` - diversity can serve a few less and that must not
  // dead-end the infinite scroll.
  const nextCursor = served.length > 0 && pool.length > served.length ? String(excludeIds.length + served.length) : null;
  return { posts, nextCursor };
}

/**
 * Recent - reverse-chronological from people you follow PLUS your own posts, so
 * a post you just made shows up immediately. New users (no follows) fall back to
 * a recent-global discovery stream instead of a dead empty tab. Keyset on
 * created_at via the `before` cursor.
 */
async function getRecentFeedPage(
  opts: { before?: string | null; limit?: number; prefs?: FeedPrefs } = {}
): Promise<FeedPage> {
  const limit = opts.limit ?? 12;
  const before = opts.before ?? null;
  const prefs = opts.prefs ?? { only_follows: false, hide_projects: false };
  const sb = await getSupabaseServer();
  if (!sb) return { posts: [], nextCursor: null };
  const { data: { user } } = await sb.auth.getUser();

  // Authors whose posts fill the Recent tab: the people you follow PLUS yourself.
  // CRITICAL: when you follow nobody, we must NOT collapse to "your own posts
  // only" (that shows a lone repost and feels broken). Instead we leave the
  // author filter OFF entirely so Recent becomes a real global discovery stream
  // of everything new across Collab47. This matches recentIsDiscovery().
  let ids: string[] = [];
  if (user) {
    const { data: follows } = await sb.from("follows").select("following_id").eq("follower_id", user.id);
    const followIds = (follows ?? []).map((f) => f.following_id as string);
    if (followIds.length > 0) {
      // Has follows -> their posts + your own, reverse-chron.
      ids = [...followIds, user.id];
    }
    // No follows -> ids stays empty -> global discovery below (includes your own).
  }

  // Over-fetch by 1 to detect whether a further page exists.
  let q = liveFilter(sb.from("posts").select(SELECT));
  if (ids.length > 0) {
    q = q.in("author_id", ids);
  }
  // hide_projects must be applied IN SQL (not just post-fetch) so that limit+1
  // counts only the rows that survive the filter - otherwise a page padded with
  // project posts shrinks below `limit` and the stream terminates early.
  if (prefs.hide_projects) {
    q = q.is("project_id", null);
  }
  // else: no user / no follows -> recent-global discovery stream (never dead).
  q = q.order("created_at", { ascending: false }).limit(limit + 1);
  if (before) q = q.lt("created_at", before);

  const { data } = await q;
  let rows = (data as unknown as PostWithAuthor[]) ?? [];
  rows = applyPrefs(rows, prefs);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].created_at : null;
  const posts = await attachReposts(sb, page);
  return { posts, nextCursor };
}

/** Whether the Recent tab is falling back to a global discovery stream. */
export async function recentIsDiscovery(): Promise<boolean> {
  const sb = await getSupabaseServer();
  if (!sb) return true;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return true;
  const { count } = await sb
    .from("follows")
    .select("following_id", { count: "exact", head: true })
    .eq("follower_id", user.id);
  return (count ?? 0) === 0;
}

/**
 * Popular - last 24h, ranked by the shrunk engagement RATE (real impressions),
 * with a minimum-signal floor so zero-engagement posts never rank as popular.
 * The 24h candidate set is bounded, so we rank in JS and page by score offset.
 */
async function getPopularFeedPage(
  opts: { offset?: number; limit?: number; prefs?: FeedPrefs } = {}
): Promise<FeedPage> {
  const limit = opts.limit ?? 12;
  const offset = opts.offset ?? 0;
  const prefs = opts.prefs ?? { only_follows: false, hide_projects: false };
  const sb = await getSupabaseServer();
  if (!sb) return { posts: [], nextCursor: null };

  const followIds = prefs.only_follows ? await getFollowIds(sb) : null;
  if (prefs.only_follows && (!followIds || followIds.length === 0)) return { posts: [], nextCursor: null };

  const since = new Date(Date.now() - 24 * 3.6e6).toISOString();
  let q = liveFilter(sb.from("posts").select(SELECT)).gte("created_at", since);
  if (followIds) q = q.in("author_id", followIds);
  const { data } = await q.limit(200);

  let rows = (data as unknown as PostWithAuthor[]) ?? [];
  rows = applyPrefs(rows, prefs)
    .filter((p) => rawEngagement(p) >= 1) // minimum-signal floor
    .sort((a, b) => engagementScore(b) - engagementScore(a));

  return sliceWindow(sb, rows, offset, limit);
}

/**
 * Trending - true VELOCITY (engagement acceleration) in a short window, branch +
 * city aware (multiplicative boost). Never silently mirrors Popular: if the 6h
 * window is empty it widens to 12h, still velocity-ranked.
 */
async function getTrendingFeedPage(
  opts: { offset?: number; limit?: number; prefs?: FeedPrefs } = {}
): Promise<FeedPage> {
  const limit = opts.limit ?? 12;
  const offset = opts.offset ?? 0;
  const prefs = opts.prefs ?? { only_follows: false, hide_projects: false };
  const sb = await getSupabaseServer();
  if (!sb) return { posts: [], nextCursor: null };

  const { data: { user } } = await sb.auth.getUser();
  let branch: string | null = null;
  let city: string | null = null;
  if (user) {
    const { data: prof } = await sb.from("profiles").select("branch, city").eq("id", user.id).maybeSingle();
    branch = (prof?.branch as string | null) ?? null;
    city = (prof?.city as string | null) ?? null;
  }

  const followIds = prefs.only_follows ? await getFollowIds(sb) : null;
  if (prefs.only_follows && (!followIds || followIds.length === 0)) return { posts: [], nextCursor: null };

  // Candidate windows WIDEN until enough genuinely-engaged posts exist, so a
  // quiet hour never makes a lone zero-engagement repost "trend". A minimum-
  // signal floor (real reactions/comments/reposts/saves) is the key guard:
  // posts with no engagement are NOT trending, they are just recent.
  const WINDOWS = [6, 24, 72, 168];
  let rows: PostWithAuthor[] = [];
  for (let i = 0; i < WINDOWS.length; i++) {
    const w = applyPrefs(await fetchWindow(sb, WINDOWS[i], followIds), prefs).filter(
      (p) => rawEngagement(p) >= 1
    );
    if (w.length >= 3 || i === WINDOWS.length - 1) {
      rows = w;
      break;
    }
  }
  if (rows.length === 0) return { posts: [], nextCursor: null };

  // Velocity = engagement RATE, decayed by age so fresher-but-engaged posts rise
  // above older ones, with a multiplicative branch/city boost.
  const vmax = Math.max(1e-6, ...rows.map(engagementScore));
  const branchL = branch?.toLowerCase();
  const cityL = city?.toLowerCase();
  const now = Date.now();
  const score = (p: PostWithAuthor) => {
    let v = engagementScore(p) / vmax; // 0..1 base velocity
    const ageH = (now - new Date(p.created_at).getTime()) / 3.6e6;
    v *= Math.exp(-ageH / 72); // recency decay: "what's hot now", not last week
    if (branchL && (p.branch_tags ?? []).some((t) => t.toLowerCase() === branchL)) v *= 1.25;
    if (cityL && (p.city_tags ?? []).some((t) => t.toLowerCase() === cityL)) v *= 1.15;
    return v;
  };
  rows = rows.sort((a, b) => score(b) - score(a));

  return sliceWindow(sb, rows, offset, limit);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFollowIds(sb: any): Promise<string[] | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("follows").select("following_id").eq("follower_id", user.id);
  return (data ?? []).map((f: { following_id: string }) => f.following_id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWindow(sb: any, hours: number, followIds: string[] | null): Promise<PostWithAuthor[]> {
  const since = new Date(Date.now() - hours * 3.6e6).toISOString();
  let q = liveFilter(sb.from("posts").select(SELECT)).gte("created_at", since);
  if (followIds) q = q.in("author_id", followIds);
  const { data } = await q.limit(200);
  return (data as unknown as PostWithAuthor[]) ?? [];
}

/** Slice a JS-ranked array by offset and attach reposts; cursor = next offset. */
async function sliceWindow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  ranked: PostWithAuthor[],
  offset: number,
  limit: number
): Promise<FeedPage> {
  const page = ranked.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < ranked.length ? String(nextOffset) : null;
  const posts = await attachReposts(sb, page);
  return { posts, nextCursor };
}
