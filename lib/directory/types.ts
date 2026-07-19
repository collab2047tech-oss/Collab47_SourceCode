/**
 * Shared types for the reference directories (institutions + DPIIT startups).
 * See lib/directory/sync.ts and app/api/directory/search/route.ts.
 */

export type DirectoryKind = "institution" | "startup";

/** A normalized row ready to upsert into public.directory_entries. */
export interface DirectoryEntryInput {
  kind: DirectoryKind;
  name: string;
  city: string | null;
  state: string | null;
  /** Free-form provenance/detail (CIN, website, AISHE code, industry, ...). */
  extra?: Record<string, unknown>;
  /** Logical source label, e.g. "bootstrap", "data.gov.in:aishe". */
  source: string;
  /** Stable id within the source (resource id + row id / code) for traceability. */
  sourceRef?: string | null;
}

/** The public search-result shape. THIS IS THE CONTRACT W4-B consumes. */
export interface DirectorySearchItem {
  name: string;
  city?: string;
  state?: string;
}

/** Per-source outcome of one sync run. */
export interface SyncSourceResult {
  source: string;
  fetched: number;
  upserted: number;
  skipped: number;
  error: string | null;
}

/** Aggregate outcome of one sync run. */
export interface SyncResult {
  ok: boolean;
  ranAt: string;
  upserted: number;
  skipped: number;
  sources: SyncSourceResult[];
}
