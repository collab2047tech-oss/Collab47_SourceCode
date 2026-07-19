/**
 * Normalization + dedupe helpers, shared by the sync and (mirrored) by the
 * seeder. Keep this logic tiny and pure so the .mjs seeder can safely replicate
 * it without importing TypeScript.
 */
import type { DirectoryEntryInput } from "./types";

/** Collapse internal whitespace runs and trim. Preserves the published casing
 *  (we do NOT force title-case - "IIT Bombay" must stay "IIT Bombay"). */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Dedupe key for the (kind, name) unique constraint - case/space insensitive. */
export function dedupeKey(kind: string, name: string): string {
  return `${kind}::${collapseWhitespace(name).toLowerCase()}`;
}

/** Normalize + dedupe a batch of entries by (kind, name). Last one wins, so a
 *  richer/newer row can override an earlier sparse one within the same batch. */
export function normalizeEntries(entries: DirectoryEntryInput[]): DirectoryEntryInput[] {
  const map = new Map<string, DirectoryEntryInput>();
  for (const e of entries) {
    const name = collapseWhitespace(e.name);
    if (!name) continue;
    map.set(dedupeKey(e.kind, name), {
      ...e,
      name,
      city: e.city ? collapseWhitespace(e.city) : null,
      state: e.state ? collapseWhitespace(e.state) : null,
      extra: e.extra ?? {},
      sourceRef: e.sourceRef ?? null,
    });
  }
  return [...map.values()];
}
