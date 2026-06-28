/**
 * Client-only news personalisation. Lives entirely in localStorage - NO database
 * writes, no extra load. Implements a lightweight TikTok-style loop: when you tap
 * "interested" on an article, topics from it gain weight, so the next shuffled
 * cycle floats similar stories up.
 */

export interface InterestProfile {
  weights: Record<string, number>;
}

export interface PersonalisableItem {
  title: string;
  branch_tags: string[];
}

const KEY = "c47_news_interest_v1";

const STOP = new Set([
  "this", "that", "with", "from", "have", "will", "your", "after", "over", "into",
  "they", "their", "what", "when", "which", "about", "would", "could", "should",
  "says", "said", "more", "than", "then", "been", "being", "amid", "live", "news",
  "india", "indian", "year", "years", "time", "first", "last", "team", "make",
]);

function safeParse(s: string | null): InterestProfile {
  if (!s) return { weights: {} };
  try {
    const p = JSON.parse(s);
    return p && typeof p === "object" && p.weights ? (p as InterestProfile) : { weights: {} };
  } catch {
    return { weights: {} };
  }
}

export function loadProfile(): InterestProfile {
  if (typeof window === "undefined") return { weights: {} };
  return safeParse(localStorage.getItem(KEY));
}

export function saveProfile(p: InterestProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full / disabled - personalisation is best-effort */
  }
}

// Topic tokens for an article: significant title words + its branch tags.
export function tokensOf(item: PersonalisableItem): string[] {
  const words = (item.title || "").toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const kept = words.filter((w) => !STOP.has(w)).slice(0, 10);
  const branch = (item.branch_tags || []).map((t) => "branch:" + t.toLowerCase());
  return [...new Set([...kept, ...branch])];
}

export function scoreItem(item: PersonalisableItem, p: InterestProfile): number {
  let s = 0;
  for (const tok of tokensOf(item)) s += p.weights[tok] ?? 0;
  return s;
}

// Add weight for everything in this article (called on "interested").
export function reinforce(p: InterestProfile, item: PersonalisableItem, amount = 1): InterestProfile {
  const weights = { ...p.weights };
  for (const tok of tokensOf(item)) weights[tok] = (weights[tok] ?? 0) + amount;
  return { weights };
}

/**
 * Personalised shuffle: interest score (whole numbers) dominates, with random
 * jitter (<1) breaking ties so the order feels fresh every cycle.
 */
export function rankShuffle<T extends PersonalisableItem>(items: T[], p: InterestProfile): T[] {
  return items
    .map((it) => ({ it, k: scoreItem(it, p) + Math.random() }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.it);
}
