import type { SearchResults } from "@/lib/db/social";

// Tiny in-memory LRU keyed by normalised query so backspacing/retyping a prior
// query renders instantly (no spinner, no network). Capped to keep memory flat.
const CAP = 40;
const cache = new Map<string, SearchResults>();

function key(q: string, compact: boolean): string {
  return `${compact ? "c" : "f"}:${q.trim().toLowerCase()}`;
}

export function getCachedSearch(q: string, compact: boolean): SearchResults | null {
  const k = key(q, compact);
  const hit = cache.get(k);
  if (!hit) return null;
  // Refresh recency (LRU): re-insert so it becomes most-recent.
  cache.delete(k);
  cache.set(k, hit);
  return hit;
}

export function setCachedSearch(q: string, compact: boolean, data: SearchResults): void {
  const k = key(q, compact);
  if (cache.has(k)) cache.delete(k);
  cache.set(k, data);
  while (cache.size > CAP) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
