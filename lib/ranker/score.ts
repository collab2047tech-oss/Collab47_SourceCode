import type { PostWithAuthor } from "@/lib/db/posts";

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

// Tchebycheff criterion weights. Match (relevance) dominates; safety is a kill switch.
export const DEFAULT_WEIGHTS: RankerWeights = {
  match: 0.4,
  recency: 0.2,
  engagement: 0.15,
  authorTrust: 0.1,
  diversity: 0.1,
  safety: 0.3,
};

export interface ScoreContext {
  interests: string[];              // user's onboarding interest tags
  branch?: string | null;           // user's branch (e.g. CSE) for branch_tags match
  seenIds: Set<string>;             // already-seen post ids
  recentTags: string[];             // primary hashtags of last served posts (diversity)
  // Optional classical-engine inputs. Empty/absent until the CF + PPR + BM25 jobs land.
  relevancy?: Map<string, number>;  // postId -> normalised BM25/FTS ts_rank (0..1)
  cf?: Map<string, number>;         // postId -> item-CF affinity (0..1)
  ppr?: Map<string, number>;        // authorId -> Personalised PageRank affinity (0..1)
}

function ageHours(iso: string): number {
  return Math.max((Date.now() - new Date(iso).getTime()) / 3.6e6, 0);
}
const lc = (s: string) => s.toLowerCase();

/**
 * scorePost: deterministic MCDM Tchebycheff scalarisation over 6 criteria.
 * s(a) = 1 - max_j { w_j * |1 - f_j(a)| }  (maximise toward ideal f_j*=1).
 * 100% classical, zero AI. Relevance fuses: interest-tag overlap (recall),
 * branch match, BM25/FTS relevancy, and item-CF affinity. Author trust fuses
 * verified status + Personalised PageRank affinity.
 */
export function scorePost(
  post: PostWithAuthor,
  ctx: ScoreContext,
  weights: RankerWeights = DEFAULT_WEIGHTS
): ScoredPost {
  const reason: string[] = [];

  // f_1 match (relevance): interest overlap + branch match + BM25 relevancy + CF.
  const interestSet = new Set(ctx.interests.map(lc));
  const tagOverlap = (post.hashtags ?? []).filter((h) => interestSet.has(lc(h))).length;
  const branchMatch =
    ctx.branch && (post.branch_tags ?? []).some((b) => lc(b) === lc(ctx.branch as string)) ? 1 : 0;
  const rel = ctx.relevancy?.get(post.id) ?? 0;
  const cf = ctx.cf?.get(post.id) ?? 0;
  const match = Math.min(0.3 + tagOverlap * 0.18 + branchMatch * 0.25 + rel * 0.3 + cf * 0.25, 1);
  if (tagOverlap > 0) reason.push(`matches ${tagOverlap} of your interests`);
  if (branchMatch) reason.push(`relevant to ${ctx.branch}`);
  if (cf > 0.01) reason.push("similar to posts you engaged with");

  // f_2 recency: exponential decay, half-life 24h.
  const recency = Math.exp(-ageHours(post.created_at) / 24);

  // f_3 engagement rate, smoothed.
  const impressions = (post as PostWithAuthor & { impressions?: number }).impressions ?? 30;
  const engagement =
    (post.like_count + 2 * post.comment_count + 4 * post.bookmark_count + 8 * post.repost_count) /
    (impressions + 10);

  // f_4 author trust: verified + Personalised PageRank affinity.
  const verified = (post.author as { verified?: boolean } | undefined)?.verified ? 1 : 0;
  const ppr = ctx.ppr?.get(post.author_id) ?? 0;
  const authorTrust = Math.min(0.35 + verified * 0.4 + ppr * 0.25, 1);

  // f_5 diversity: penalise if primary tag repeats recently served posts.
  const primary = (post.hashtags ?? [])[0]?.toLowerCase();
  const diversity = primary && ctx.recentTags.includes(primary) ? 0.3 : 1;

  // f_6 safety kill switch (read-feed already drops flagged posts).
  const safety = 1;

  const criteria: Array<[number, number]> = [
    [weights.match, match],
    [weights.recency, recency],
    [weights.engagement, Math.min(engagement, 1)],
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
 * exploration slot (Thompson-sampling stub: a mid-score post the greedy pass skipped).
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
  if (remaining.length > 0) {
    picked.push(remaining[Math.floor(remaining.length / 2)]);
  }

  return picked.slice(0, k);
}
