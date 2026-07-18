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
 * scorePost: the single "For You" score function. Deterministic ranking over the
 * shared feature vector (lib/ranker/features). Two interchangeable heads, SAME
 * features, and identical serving-time re-ranks - so the blend is one formula:
 *
 *   - NEURAL head (ctx.model): score = P(engage) from the trained net. 100% real,
 *     learned offline from real interactions; forward pass is plain JS, $0 to serve.
 *   - MCDM head (default / cold-start): hand-tuned Tchebycheff scalarisation over
 *     four blended criteria (weights = DEFAULT_WEIGHTS unless learned weights
 *     exist), which beats an under-trained net until enough real data exists:
 *
 *       match       = interest/hashtag semantic match (v0) + branch (v1) + BM25
 *                     (v2) + item-CF (v3) + revealed-behaviour affinity (v4)
 *       recency     = exp decay on age, ~16.6h half-life (e^-age/24)  (v5)
 *       engagement  = Bayesian engagement RATE eng/(impr+10) (v6) + 6h velocity (v7)
 *       authorTrust = follow-affinity boost: verified (v8) + personalised PageRank
 *                     ppr [followed=1.0, 2nd-degree=0.5] (v9) + field proximity (v10)
 *
 * Serving-time re-ranks (applied to BOTH heads so the two can never drift):
 *   - tag-diversity penalty  (this post's primary tag already used higher up)
 *   - already-seen penalty   (strongly demote posts the viewer has seen)
 * Author-diversity ("no one author monopolising the page") is enforced at
 * SELECTION time in diversifyTopK, where the ordering is true score order.
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
 * diversifyTopK: greedy max-coverage that keeps the page from tunnelling on one
 * topic OR one author. Enforces two diversity guards over the score-sorted list:
 *   - TAG variety: prefer distinct primary hashtags until 4 are covered.
 *   - AUTHOR variety ("no monopolising"): a single author may fill at most
 *     ~1/4 of the page (min 2), so a prolific poster can't dominate the feed.
 * A final safety pass relaxes the caps only if they would starve the page below
 * k, so a thin pool never dead-ends the infinite scroll.
 */
export function diversifyTopK(scored: ScoredPost[], k = 12): ScoredPost[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: ScoredPost[] = [];
  const coveredTags = new Set<string>();
  const authorCount = new Map<string, number>();
  const maxPerAuthor = Math.max(2, Math.ceil(k / 4));
  const authorOk = (a: string) => (authorCount.get(a) ?? 0) < maxPerAuthor;
  const take = (p: ScoredPost) => {
    picked.push(p);
    const primary = p.hashtags[0]?.toLowerCase();
    if (primary) coveredTags.add(primary);
    authorCount.set(p.author_id, (authorCount.get(p.author_id) ?? 0) + 1);
  };

  // Pass 1: prefer BOTH tag variety and author variety (honour the author cap).
  for (const p of sorted) {
    if (picked.length >= k) break;
    if (!authorOk(p.author_id)) continue;
    const primary = p.hashtags[0]?.toLowerCase();
    if (!primary || !coveredTags.has(primary) || coveredTags.size >= 4) take(p);
  }
  // Pass 2: fill leftover slots by score, still honouring the author cap.
  if (picked.length < k) {
    const have = new Set(picked);
    for (const p of sorted) {
      if (picked.length >= k) break;
      if (have.has(p) || !authorOk(p.author_id)) continue;
      take(p);
      have.add(p);
    }
  }
  // Pass 3 (safety): if the author cap starved the page, relax it so we ALWAYS
  // return min(k, scored.length) and never dead-end the infinite scroll.
  if (picked.length < k) {
    const have = new Set(picked);
    for (const p of sorted) {
      if (picked.length >= k) break;
      if (!have.has(p)) {
        picked.push(p);
        have.add(p);
      }
    }
  }
  return picked.slice(0, k);
}
