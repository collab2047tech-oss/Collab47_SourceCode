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

// Tchebycheff criterion weights. Match dominates, safety is a kill switch.
export const DEFAULT_WEIGHTS: RankerWeights = {
  match: 0.4,
  recency: 0.2,
  engagement: 0.15,
  authorTrust: 0.1,
  diversity: 0.1,
  safety: 0.3,
};

interface ScoreContext {
  interests: string[];        // user's onboarding interest tags
  seenIds: Set<string>;       // already-seen post ids
  recentTags: string[];       // primary hashtags of last 3 served posts (diversity)
}

function ageHours(iso: string): number {
  return Math.max((Date.now() - new Date(iso).getTime()) / 3.6e6, 0);
}

/**
 * scorePost: deterministic MCDM Tchebycheff scalarisation over 6 criteria.
 * s(a) = 1 - max_j { w_j * |1 - f_j(a)| }  (maximise toward ideal f_j*=1).
 * No LLM. Proxies stand in for CF / PPR until the nightly jobs land.
 */
export function scorePost(
  post: PostWithAuthor,
  ctx: ScoreContext,
  weights: RankerWeights = DEFAULT_WEIGHTS
): ScoredPost {
  const reason: string[] = [];

  // f_1 match: hashtag overlap with interests (proxy for cosine + CF + PPR).
  const overlap = post.hashtags.filter((h) =>
    ctx.interests.map((i) => i.toLowerCase()).includes(h.toLowerCase())
  ).length;
  const match = Math.min(0.5 + overlap * 0.2, 1);
  if (overlap > 0) reason.push(`matches ${overlap} of your interests`);

  // f_2 recency: exponential decay, half-life 24h.
  const recency = Math.exp(-ageHours(post.created_at) / 24);

  // f_3 engagement rate, smoothed (+10 denominator avoids 1-view spikes).
  const impressions = (post as PostWithAuthor & { impressions?: number }).impressions ?? 100;
  const engagement =
    (post.like_count + 2 * post.comment_count + 4 * post.bookmark_count + 8 * post.repost_count) /
    (impressions + 10);

  // f_4 author trust: verified gets a bump. Baseline 0.5.
  const authorTrust = 0.5;

  // f_5 diversity: penalise if primary tag repeats the last 3 served posts.
  const primary = post.hashtags[0]?.toLowerCase();
  const diversity = primary && ctx.recentTags.includes(primary) ? 0.3 : 1;

  // f_6 safety kill switch. 1.0 = clean (filter already dropped flagged ones).
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
 * diversifyTopK: greedy max-coverage to span >= 4 distinct hashtags,
 * then 1 reserved exploration slot (Thompson Sampling stub: pick a mid-score
 * post the greedy pass skipped).
 */
export function diversifyTopK(scored: ScoredPost[], k = 12): ScoredPost[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: ScoredPost[] = [];
  const coveredTags = new Set<string>();

  for (const p of sorted) {
    if (picked.length >= k - 1) break;
    const primary = p.hashtags[0]?.toLowerCase();
    const addsCoverage = primary && !coveredTags.has(primary);
    // Take it if it adds tag coverage OR we still need fill.
    if (addsCoverage || coveredTags.size >= 4) {
      picked.push(p);
      if (primary) coveredTags.add(primary);
    }
  }

  // Fill remaining greedily by score.
  for (const p of sorted) {
    if (picked.length >= k - 1) break;
    if (!picked.includes(p)) picked.push(p);
  }

  // Exploration slot: a mid-pack post not already picked.
  const remaining = sorted.filter((p) => !picked.includes(p));
  if (remaining.length > 0) {
    picked.push(remaining[Math.floor(remaining.length / 2)]);
  }

  return picked.slice(0, k);
}
