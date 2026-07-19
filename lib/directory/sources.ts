/**
 * Government data sources (data.gov.in / OGD platform).
 *
 * Endpoint shape (verified working shape, key-gated):
 *   https://api.data.gov.in/resource/<resourceId>?api-key=<key>&format=json&offset=<n>&limit=<n>
 * Response: { records: [...], total: <int>, count: <int>, ... } or { error: "..." }.
 *
 * STATUS (verified 2026-07-19): the public sample api-key returns HTTP 403
 * {"error":"Key not authorised"}. So live government pulls require the founder's
 * own free key in DATA_GOV_IN_API_KEY. Resource ids are confirmed real (scraped
 * from the catalog pages) and overridable via env, so the moment a key is set the
 * sync pulls live data with no code change. Until then, sync/seed use bootstrap.
 */
import type { DirectoryEntryInput, DirectoryKind } from "./types";
import { collapseWhitespace } from "./normalize";

const BASE = "https://api.data.gov.in/resource";

/** Free public sample key (documented by data.gov.in). Rate-limited / often
 *  "Key not authorised" - the real key belongs in DATA_GOV_IN_API_KEY. */
const SAMPLE_KEY = "579b464db66ec23bdd000001cdd3946e44ce396f6ec19b3255ba7f9d";

export function dataGovKey(): string {
  return process.env.DATA_GOV_IN_API_KEY?.trim() || SAMPLE_KEY;
}

/** True when a real (non-sample) key is configured. */
export function hasRealDataGovKey(): boolean {
  const k = process.env.DATA_GOV_IN_API_KEY?.trim();
  return Boolean(k && k !== SAMPLE_KEY);
}

interface GovSource {
  /** Logical label stored in directory_entries.source. */
  label: string;
  kind: DirectoryKind;
  /** data.gov.in resource UUID (env-overridable). */
  resourceId: string;
  /** Candidate field names for the entity name, in priority order. */
  nameKeys: string[];
  cityKeys: string[];
  stateKeys: string[];
  /** Extra fields to carry into `extra` jsonb if present. */
  extraKeys: string[];
}

/**
 * Confirmed resource ids (scraped from data.gov.in catalog pages 2026-07-19):
 *   - AISHE list of colleges: 48d9c89e-e08b-46f1-b019-96ea5d5b1748
 *   - DPIIT startups (industry/state/year wise): b961c317-9fe7-4de2-bc25-9a15b2ec3782
 *
 * NOTE on DPIIT: the open DPIIT dataset is largely AGGREGATE counts (year / state /
 * industry / number_of_startups), not a per-company name list. mapRow() therefore
 * SKIPS rows with no usable company name, so pointing DATA_GOV_IN_DPIIT_RESOURCE
 * at a genuine per-startup resource "just works", while the aggregate default
 * contributes nothing (bootstrap remains the startup source). See docs/DIRECTORY.md.
 */
export const GOV_SOURCES: GovSource[] = [
  {
    label: "data.gov.in:aishe-colleges",
    kind: "institution",
    resourceId:
      process.env.DATA_GOV_IN_AISHE_RESOURCE?.trim() ||
      "48d9c89e-e08b-46f1-b019-96ea5d5b1748",
    nameKeys: [
      "institution_name",
      "name_of_the_institution",
      "name_of_institution",
      "college_name",
      "university_name",
      "name",
    ],
    cityKeys: ["district_name", "district", "city", "location"],
    stateKeys: ["state_name", "state", "state_ut"],
    extraKeys: ["aishe_code", "type", "management", "university_name"],
  },
  {
    label: "data.gov.in:dpiit-startups",
    kind: "startup",
    resourceId:
      process.env.DATA_GOV_IN_DPIIT_RESOURCE?.trim() ||
      "b961c317-9fe7-4de2-bc25-9a15b2ec3782",
    nameKeys: [
      "company_name",
      "name_of_the_company",
      "name_of_company",
      "startup_name",
      "entity_name",
      "name",
    ],
    cityKeys: ["city", "city_name", "location", "district"],
    stateKeys: ["state", "state_name", "state_ut"],
    extraKeys: ["cin", "website", "industry", "sector", "focus_industry", "company_status"],
  },
];

interface GovResponse {
  records?: Array<Record<string, unknown>>;
  total?: number;
  count?: number;
  error?: string;
  message?: string;
}

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return collapseWhitespace(v);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function mapRow(row: Record<string, unknown>, src: GovSource): DirectoryEntryInput | null {
  const name = pick(row, src.nameKeys);
  // No usable name (e.g. an aggregate count row) -> skip, never store a blank.
  if (!name) return null;
  const extra: Record<string, unknown> = {};
  for (const k of src.extraKeys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") extra[k] = v;
  }
  return {
    kind: src.kind,
    name,
    city: pick(row, src.cityKeys),
    state: pick(row, src.stateKeys),
    extra,
    source: src.label,
    sourceRef: `${src.resourceId}`,
  };
}

/**
 * Page through one government resource, mapping + skipping rows as we go.
 * Bounded by `maxRecords` so a serverless invocation stays inside its budget.
 * Throws on an API-level error ({"error": ...}) or non-OK HTTP so the caller can
 * record it per-source without aborting the other sources.
 */
export async function fetchGovSource(
  src: GovSource,
  opts: { pageSize?: number; maxRecords?: number; signal?: AbortSignal } = {}
): Promise<{ entries: DirectoryEntryInput[]; fetched: number }> {
  const pageSize = opts.pageSize ?? 1000;
  const maxRecords = opts.maxRecords ?? 60000;
  const key = dataGovKey();
  const entries: DirectoryEntryInput[] = [];
  let fetched = 0;
  let offset = 0;

  for (;;) {
    const url =
      `${BASE}/${src.resourceId}?api-key=${encodeURIComponent(key)}` +
      `&format=json&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      signal: opts.signal,
      headers: { accept: "application/json" },
      // Reference data; let the platform CDN cache aggressively upstream.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${src.label} (${src.resourceId})`);
    }
    const body = (await res.json()) as GovResponse;
    if (body.error) {
      throw new Error(`${src.label}: ${body.error}`);
    }
    const records = body.records ?? [];
    if (records.length === 0) break;

    for (const row of records) {
      fetched += 1;
      const mapped = mapRow(row, src);
      if (mapped) entries.push(mapped);
    }

    offset += records.length;
    const total = typeof body.total === "number" ? body.total : Infinity;
    if (offset >= total || offset >= maxRecords || records.length < pageSize) break;
  }

  return { entries, fetched };
}
