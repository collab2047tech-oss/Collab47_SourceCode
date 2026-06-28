/**
 * Classical news ranker - the news analogue of `lib/db/feed.ts`'s scorer.
 *
 * Same philosophy as feed / trending / people: recall recent items, then SCORE
 * each with a weighted blend of features, then a small diversity pass. Zero ML,
 * zero extra cost. It reuses `lib/ranker/taxonomy.ts` so an "AI/ML" student
 * matches a generically-tagged GPU/LLM story even without the exact word.
 */

import type { NewsItem } from "@/lib/supabase/types";
import { semanticMatch } from "@/lib/ranker/taxonomy";

export interface NewsViewer {
  interests: string[];
  branch: string | null;
  city: string | null;
}

// Curated source trust. Established mastheads with real bodies score high; thin
// aggregator/headline feeds score low. Unknown sources sit in the middle.
const SOURCE_TRUST: Record<string, number> = {
  "The Hindu": 1,
  "LiveMint": 0.95,
  "The Guardian": 1,
  "New York Times": 1,
  "MoneyControl": 0.85,
  "NewsData": 0.8,
  "GNews": 0.8,
  "Mediastack": 0.75,
  "TheNewsAPI": 0.75,
  "Currents": 0.7,
  "Hacker News": 0.6,
};

function sourceTrust(source: string): number {
  return SOURCE_TRUST[source] ?? 0.65;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function ageHours(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

/** Best affinity weight across an item's topics (durable, per-user, 0..1-ish). */
function maxTopicWeight(topics: string[], map: Map<string, number>): number {
  let best = 0;
  for (const t of topics) {
    const w = map.get(t.toLowerCase());
    if (w !== undefined && w > best) best = w;
  }
  return best;
}

export interface RankInputs {
  items: NewsItem[];
  viewer: NewsViewer;
  /** Durable per-user topic affinity (from news_topic_affinity), normalised. */
  affinity: Map<string, number>;
  /** Reading-behaviour topic affinity (from news_events opens/saves), normalised. */
  behaviour: Map<string, number>;
  limit: number;
}

/**
 * Score every item, sort, then diversify so the same topic doesn't stack 5-deep
 * at the top. Returns the top `limit` items.
 */
export function rankNews({ items, viewer, affinity, behaviour, limit }: RankInputs): NewsItem[] {
  const interests = viewer.interests ?? [];

  const scored = items.map((item) => {
    const matchTags = [...item.topics, ...item.branch_tags];
    const semantic = semanticMatch(interests, matchTags);
    const branchMatch =
      viewer.branch && item.branch_tags.includes(viewer.branch) ? 1 : 0;
    const recency = Math.exp(-ageHours(item.published_at) / 24);
    const aff = maxTopicWeight(item.topics, affinity);
    const beh = maxTopicWeight(item.topics, behaviour);
    const trust = sourceTrust(item.source);
    const popularity = clamp01(
      (item.like_count + 2 * item.comment_count) / (item.like_count + 2 * item.comment_count + 10)
    );

    const score =
      0.34 * semantic +
      0.30 * recency +
      0.14 * aff +
      0.10 * beh +
      0.06 * branchMatch +
      0.04 * trust +
      0.02 * popularity;

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Greedy diversity: walk the sorted list and lightly demote an item whose
  // primary topic is already heavily represented in the chosen set, so the top
  // of the feed isn't five Business cards in a row. We do not drop anything;
  // we just reorder by penalised score.
  const topicCount = new Map<string, number>();
  const penalised = scored.map(({ item, score }) => {
    const primary = (item.topics[0] ?? "").toLowerCase();
    const seen = topicCount.get(primary) ?? 0;
    topicCount.set(primary, seen + 1);
    const penalty = seen * 0.04; // each prior same-topic item costs a little
    return { item, score: score - penalty };
  });
  penalised.sort((a, b) => b.score - a.score);

  return penalised.slice(0, limit).map((s) => s.item);
}
