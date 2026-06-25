import type { PostWithAuthor } from "@/lib/db/posts";
import { semanticMatch } from "@/lib/ranker/taxonomy";

export interface ScoredPost extends PostWithAuthor {
  score: number;
  reason: string[];
}

export interface RankerWeights {
  match: number;
  recency: number;
  engagement: number;
  authorTrust: number;
  diversity: number;
  safety: number;
}

// Tchebycheff criterion weights. Match (relevance) dominates; safety is a kill
// switch. These DEFAULTS are the cold-start prior; the nightly logistic-regression
// job (lib/ranker/fit) overwrites them with weights LEARNED from real behaviour.
export const DEFAULT_WEIGHTS: RankerWeights = {
  match: 0.4,
  recency: 0.2,
  engagement: 0.18,
  authorTrust: 0.12,
  diversity: 0.1,
  safety: 0.3,
};

export interface ViewerFields {
  college?: string | null;
  branch?: string | null;
  year?: string | null;
  city?: string | null;
}

export interface ScoreContext {
  interests: string[];              // user's onboarding interest tags
  branch?: string | null;           // user's branch (e.g. CSE) for branch_tags match
  seenIds: Set<string>;             // already-seen post ids (from feed_events impressions)
  recentTags: string[];             // primary hashtags of last served posts (diversity)
  relevancy?: Map<string, number>;  // postId -> normalised BM25/FTS ts_rank (0..1)
  cf?: Map<string, number>;         // postId -> item-CF affinity (0..1)
  ppr?: Map<string, number>;        // authorId -> Personalised PageRank affinity (0..1)
  // --- semantic + field + behavioural signals (zero-cost classical engine) ---
  viewer?: ViewerFields;            // viewer's cohort fields, for field/location match
  behaviorAffinity?: Map<string, number>; // tag -> revealed preference from feed_events (0..1)
  velocity?: Map<string, number>;   // postId -> engagement velocity, "hot right now" (0..1)
  weights?: RankerWeights;          // learned weights override (from ranker_weights)
}

function ageHours(iso: string): number {
  return Math.max((Date.now() - new Date(iso).getTime()) / 3.6e6, 0);
}
const lc = (s: string) => s.toLowerCase();
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Cohort/field proximity between the viewer and a post's author (0..1):
// same college, same branch, same city, similar year. The "people like me /
// near me / in my field" signal — pure structured overlap, zero cost.
function fieldProximity(viewer: ViewerFields | undefined, author: Record<string, unknown> | undefined): { score: number; sameCity: boolean; sameCollege: boolean } {
  if (!viewer || !author) return { score: 0, sameCity: false, sameCollege: false };
  const eq = (a?: unknown, b?: unknown) => a && b && lc(String(a)) === lc(String(b));
  const sameCollege = Boolean(eq(viewer.college, author.college));
  const sameBranch = Boolean(eq(viewer.branch, author.branch));
  const sameCity = Boolean(eq(viewer.city, author.city));
  let yearClose = false;
  if (viewer.year && author.year_of_study) {
    yearClose = Math.abs(Number(viewer.year) - Number(author.year_of_study)) <= 1;
  }
  const score = clamp01(
    (sameCollege ? 0.5 : 0) + (sameBranch ? 0.3 : 0) + (sameCity ? 0.25 : 0) + (yearClose ? 0.15 : 0)
  );
  return { score, sameCity, sameCollege };
}

/**
 * scorePost: deterministic MCDM Tchebycheff scalarisation. 100% classical, zero
 * AI/API cost. Relevance ("match") fuses FIVE real signals:
 *   - graded SEMANTIC match via the tag taxonomy (LLM ~ AI/ML), not just exact overlap
 *   - branch_tags match
 *   - BM25/FTS keyword relevancy
 *   - item-CF co-engagement affinity
 *   - BEHAVIOURAL affinity (what the viewer actually engages with — revealed, not declared)
 * Author trust fuses verified + Personalised PageRank + cohort/field proximity.
 * Engagement fuses smoothed engagement-rate (real impressions) + velocity ("hot now").
 */
export function scorePost(post: PostWithAuthor, ctx: ScoreContext): ScoredPost {
  const reason: string[] = [];
  const weights = ctx.weights ?? DEFAULT_WEIGHTS;
  const tags = (post.hashtags ?? []).map(lc);

  // f_1 MATCH (relevance) — the heart.
  const semantic = semanticMatch(ctx.interests, tags);          // graded 0..1 via taxonomy
  const branchMatch =
    ctx.branch && (post.branch_tags ?? []).some((b) => lc(b) === lc(ctx.branch as string)) ? 1 : 0;
  const rel = ctx.relevancy?.get(post.id) ?? 0;
  const cf = ctx.cf?.get(post.id) ?? 0;
  let behaviorAff = 0;
  if (ctx.behaviorAffinity) for (const t of tags) behaviorAff = Math.max(behaviorAff, ctx.behaviorAffinity.get(t) ?? 0);
  const match = clamp01(0.22 + semantic * 0.35 + branchMatch * 0.18 + rel * 0.18 + cf * 0.18 + behaviorAff * 0.32);
  if (semantic >= 1) reason.push("matches your interests");
  else if (semantic > 0) reason.push("related to your interests");
  if (branchMatch) reason.push(`for ${ctx.branch}`);
  if (rel > 0) reason.push("keyword-relevant");
  if (cf > 0.01) reason.push("liked by similar people");
  if (behaviorAff > 0.1) reason.push("you engage with this topic");

  // f_2 RECENCY — exponential decay, half-life 24h.
  const recency = Math.exp(-ageHours(post.created_at) / 24);

  // f_3 ENGAGEMENT — smoothed real engagement-rate + velocity ("hot right now").
  const impressions = (post as PostWithAuthor & { impressions?: number }).impressions ?? 0;
  const engagementRate =
    (post.like_count + 2 * post.comment_count + 4 * post.bookmark_count + 8 * post.repost_count) /
    (impressions + 10);
  const vel = ctx.velocity?.get(post.id) ?? 0;
  const engagement = clamp01(engagementRate + vel * 0.35);
  if (vel > 0.3) reason.push("trending now");

  // f_4 AUTHOR TRUST — verified + Personalised PageRank + cohort/field proximity.
  const verified = (post.author as { verified?: boolean } | undefined)?.verified ? 1 : 0;
  const ppr = ctx.ppr?.get(post.author_id) ?? 0;
  const field = fieldProximity(ctx.viewer, post.author as Record<string, unknown> | undefined);
  const authorTrust = clamp01(0.28 + verified * 0.3 + ppr * 0.25 + field.score * 0.25);
  if (ppr >= 1) reason.push("from your network");
  else if (ppr > 0) reason.push("2nd-degree");
  if (field.sameCollege) reason.push("same college");
  else if (field.sameCity) reason.push("near you");

  // f_5 DIVERSITY — penalise repeating the primary tag of recently served posts.
  const primary = tags[0];
  const diversity = primary && ctx.recentTags.includes(primary) ? 0.3 : 1;

  // f_6 SAFETY — kill switch (read-feed already drops flagged posts).
  const safety = 1;

  const criteria: Array<[number, number]> = [
    [weights.match, match],
    [weights.recency, recency],
    [weights.engagement, engagement],
    [weights.authorTrust, authorTrust],
    [weights.diversity, diversity],
    [weights.safety, safety],
  ];

  const tcheby = 1 - Math.max(...criteria.map(([w, f]) => w * Math.abs(1 - f)));
  const seenPenalty = ctx.seenIds.has(post.id) ? 0.5 : 0;
  const score = tcheby - seenPenalty;
  if (seenPenalty) reason.push("seen before");

  return { ...post, score, reason };
}

/**
 * diversifyTopK: greedy max-coverage to span distinct hashtags, then a reserved
 * exploration slot (mid-score post the greedy pass skipped) so the feed explores
 * beyond the obvious — the serendipity that keeps a feed alive.
 */
export function diversifyTopK(scored: ScoredPost[], k = 12): ScoredPost[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: ScoredPost[] = [];
  const coveredTags = new Set<string>();

  for (const p of sorted) {
    if (picked.length >= k - 1) break;
    const primary = p.hashtags[0]?.toLowerCase();
    const addsCoverage = primary && !coveredTags.has(primary);
    if (addsCoverage || coveredTags.size >= 4) {
      picked.push(p);
      if (primary) coveredTags.add(primary);
    }
  }
  for (const p of sorted) {
    if (picked.length >= k - 1) break;
    if (!picked.includes(p)) picked.push(p);
  }
  const remaining = sorted.filter((p) => !picked.includes(p));
  if (remaining.length > 0) picked.push(remaining[Math.floor(remaining.length / 2)]);

  return picked.slice(0, k);
}
