// Recent searches, stored locally only (private, no DB). Mirrors the guarded
// localStorage pattern used elsewhere in the app. Most-recent first, de-duped.

const KEY = "c47:recent-searches";
const MAX = 6;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  const q = query.trim();
  if (!q) return;
  try {
    const current = getRecentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase());
    const next = [q, ...current].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable - non-fatal */
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}
