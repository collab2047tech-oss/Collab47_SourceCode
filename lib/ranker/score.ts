import type { PostWithAuthor } from "@/lib/db/posts";
import { extractFeatures } from "@/lib/ranker/features";
import { predict, type RankerModel } from "@/lib/ranker/model";

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

// Tchebycheff criterion weights - the cold-start prior used until the trained
// neural ranker is active. (The neural ranker, when present, replaces this.)
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
  interests: string[];
  branch?: string | null;
  seenIds: Set<string>;
  recentTags: string[];
  relevancy?: Map<string, number>;
  cf?: Map<string, number>;
  ppr?: Map<string, number>;
  viewer?: ViewerFields;
  behaviorAffinity?: Map<string, number>;
  velocity?: Map<string, number>;
  weights?: RankerWeights;
  // Trained neural ranker. When present + validated, it REPLACES the MCDM
  // scalarisation: score = P(engage) predicted by the model from the features.
  model?: RankerModel;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * scorePost: deterministic ranking over the shared feature vector (lib/ranker/
 * features). Two interchangeable heads, same features:
 *   - NEURAL head (ctx.model): score = P(engage) from the trained net. 100% real,
 *     learned offline from real interactions; forward pass is plain JS, $0 to serve.
 *   - MCDM head (default / cold-start): hand-tuned Tchebycheff scalarisation,
 *     which beats an under-trained net until enough real data exists.
 * Diversity + already-seen penalties are applied identically to both heads.
 */
export function scorePost(post: PostWithAuthor, ctx: ScoreContext): ScoredPost {
  const reason: string[] = [];
  const f = extractFeatures(post, ctx);

  if (f.semantic >= 1) reason.push("matches your interests");
  else if (f.semantic > 0) reason.push("related to your interests");
  if (f.branchMatch) reason.push(`for ${ctx.branch}`);
  if (f.rel > 0) reason.push("keyword-relevant");
  if (f.cf > 0.01) reason.push("liked by similar people");
  if (f.behaviorAff > 0.1) reason.push("you engage with this topic");
  if (f.velocity > 0.3) reason.push("trending now");
  if (f.ppr >= 1) reason.push("from your network");
  else if (f.ppr > 0) reason.push("2nd-degree");
  if (f.field.sameCollege) reason.push("same college");
  else if (f.field.sameCity) reason.push("near you");

  let base: number;
  if (ctx.model) {
    // Neural ranker: predicted probability the viewer engages with this post.
    base = predict(f.values, ctx.model);
    reason.push("ranked by learned model");
  } else {
    const w = ctx.weights ?? DEFAULT_WEIGHTS;
    const v = f.values;
    const match = clamp01(0.22 + v[0] * 0.35 + v[1] * 0.18 + v[2] * 0.18 + v[3] * 0.18 + v[4] * 0.32); // semantic/branch/bm25/cf/behaviour
    const recency = v[5];
    const engagement = clamp01(v[6] + v[7] * 0.35); // engagementRate + velocity
    const authorTrust = clamp01(0.28 + v[8] * 0.3 + v[9] * 0.25 + v[10] * 0.25); // verified + ppr + field
    const criteria: Array<[number, number]> = [
      [w.match, match], [w.recency, recency], [w.engagement, engagement],
      [w.authorTrust, authorTrust], [w.diversity, 1], [w.safety, 1],
    ];
    base = 1 - Math.max(...criteria.map(([wj, fj]) => wj * Math.abs(1 - fj)));
  }

  // Serving-time re-ranks applied to BOTH heads.
  const primary = (post.hashtags ?? [])[0]?.toLowerCase();
  const diversityPenalty = primary && ctx.recentTags.includes(primary) ? 0.08 : 0;
  const seenPenalty = ctx.seenIds.has(post.id) ? 0.5 : 0;
  if (seenPenalty) reason.push("seen before");

  return { ...post, score: base - diversityPenalty - seenPenalty, reason };
}

/**
 * diversifyTopK: greedy max-coverage over distinct hashtags + a reserved
 * exploration slot - the serendipity that keeps the feed from tunnelling.
 */
export function diversifyTopK(scored: ScoredPost[], k = 12): ScoredPost[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: ScoredPost[] = [];
  const coveredTags = new Set<string>();

  // Pass 1: prefer tag diversity (skip a post whose primary tag is already
  // covered, until 4 distinct tags are covered, then take purely by score).
  for (const p of sorted) {
    if (picked.length >= k) break;
    const primary = p.hashtags[0]?.toLowerCase();
    if (!primary || !coveredTags.has(primary) || coveredTags.size >= 4) {
      picked.push(p);
      if (primary) coveredTags.add(primary);
    }
  }
  // Pass 2: fill any leftover slots with the highest-scored not-yet-picked, so
  // we ALWAYS return min(k, scored.length). A short page (< k) must never
  // dead-end the infinite scroll.
  if (picked.length < k) {
    const have = new Set(picked);
    for (const p of sorted) {
      if (picked.length >= k) break;
      if (!have.has(p)) picked.push(p);
    }
  }
  return picked.slice(0, k);
}
