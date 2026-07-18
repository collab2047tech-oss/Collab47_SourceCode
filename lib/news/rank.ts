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

// Never emit more than this many consecutive items from the same source, so the
// reader never scrolls through a wall of one masthead (well inside "no 6-in-a-row").
const MAX_SOURCE_RUN = 3;

/**
 * Score every item, sort, then diversify. Returns the top `limit` items.
 *
 * SCORE (per item, all terms 0..1, weights sum to 1.0). Zero runtime cost - it
 * reuses data the caller already loaded (profile interests/branch, durable topic
 * affinity, reading-behaviour affinity). No new query, no N+1.
 *
 *   score = 0.34 * semantic     (a) interest-tag overlap w/ profile.interests
 *         + 0.30 * recency      (c) exp decay, ~16.6h half-life (e^-age/24)
 *         + 0.14 * affinity     (b) durable "more like this" topic signal
 *         + 0.10 * behaviour    (b) opens/saves/discussions already logged
 *         + 0.06 * branchMatch  field match (viewer.branch in branch_tags)
 *         + 0.04 * sourceTrust  masthead credibility prior
 *         + 0.02 * popularity   shrunk like/comment rate (weak tie-breaker)
 *
 * DIVERSITY (d) is a two-stage guard applied AFTER scoring, so relevance leads
 * and monotony is broken without dropping anything:
 *   1. Soft demotion: each additional item sharing a primary TOPIC or a SOURCE
 *      already seen higher up loses a little score (topic 0.04, source 0.03 per
 *      prior occurrence) - stops one topic/source dominating the head of the feed.
 *   2. Hard run guard: the final emission never places more than MAX_SOURCE_RUN
 *      consecutive items from one source; when the next-best would exceed the run
 *      we take the best item from a different source instead.
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

  // Stage 1 - soft demotion by BOTH primary topic and source. Walk the sorted
  // list; the first item of a topic/source keeps its score, each later one pays a
  // small escalating penalty. Nothing is dropped; we just re-order by penalty.
  const topicCount = new Map<string, number>();
  const sourceCount = new Map<string, number>();
  const penalised = scored.map(({ item, score }) => {
    const topic = (item.topics[0] ?? "").toLowerCase();
    const source = item.source.toLowerCase();
    const tSeen = topicCount.get(topic) ?? 0;
    const sSeen = sourceCount.get(source) ?? 0;
    topicCount.set(topic, tSeen + 1);
    sourceCount.set(source, sSeen + 1);
    const penalty = tSeen * 0.04 + sSeen * 0.03;
    return { item, score: score - penalty };
  });
  penalised.sort((a, b) => b.score - a.score);

  // Stage 2 - hard adjacency guard. Emit greedily by score, but if the last
  // MAX_SOURCE_RUN picks all share a source, reach past the next same-source item
  // for the best-scoring one from a DIFFERENT source (falling back to score order
  // only when no alternative remains). Guarantees no long same-source runs.
  const queue = penalised.slice();
  const out: NewsItem[] = [];
  let lastSource = "";
  let run = 0;
  while (out.length < limit && queue.length > 0) {
    let idx = 0;
    if (run >= MAX_SOURCE_RUN) {
      const alt = queue.findIndex((s) => s.item.source.toLowerCase() !== lastSource);
      if (alt !== -1) idx = alt;
    }
    const [chosen] = queue.splice(idx, 1);
    const src = chosen.item.source.toLowerCase();
    run = src === lastSource ? run + 1 : 1;
    lastSource = src;
    out.push(chosen.item);
  }
  return out;
}
