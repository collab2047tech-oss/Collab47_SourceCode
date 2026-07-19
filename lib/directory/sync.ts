/**
 * Directory sync orchestrator (server-only).
 *
 * Composes sources in PRIORITY ORDER and UPSERTs each into public.directory_entries:
 *   1. bootstrap  (always - guarantees day-one data even with zero API keys)
 *   2. data.gov.in AISHE institutions   (only when a real key is configured)
 *   3. data.gov.in DPIIT startups       (only when a real key is configured)
 *
 * Government sources run AFTER bootstrap so live data overrides bootstrap rows on
 * the (kind, name) conflict. The sync is UPSERT-ONLY and never truncates: if a
 * source errors or returns nothing, existing rows are untouched. Each source is
 * isolated in try/catch, so one failure cannot abort the others.
 */
import { getAdminClient } from "@/lib/supabase/admin";
import { BOOTSTRAP_ENTRIES } from "./bootstrap";
import { GOV_SOURCES, fetchGovSource, hasRealDataGovKey } from "./sources";
import { normalizeEntries } from "./normalize";
import type { DirectoryEntryInput, SyncResult, SyncSourceResult } from "./types";

type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

const UPSERT_BATCH = 500;

function toRow(e: DirectoryEntryInput) {
  return {
    kind: e.kind,
    name: e.name,
    city: e.city,
    state: e.state,
    extra: e.extra ?? {},
    source: e.source,
    source_ref: e.sourceRef ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** Upsert one already-normalized batch, chunked. Returns rows written. */
async function upsertEntries(client: AdminClient, entries: DirectoryEntryInput[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < entries.length; i += UPSERT_BATCH) {
    const chunk = entries.slice(i, i + UPSERT_BATCH).map(toRow);
    const { error } = await client
      .from("directory_entries")
      .upsert(chunk, { onConflict: "kind,name" });
    if (error) throw new Error(error.message);
    written += chunk.length;
  }
  return written;
}

async function runOne(
  client: AdminClient,
  label: string,
  load: () => Promise<{ entries: DirectoryEntryInput[]; fetched: number }>
): Promise<SyncSourceResult> {
  try {
    const { entries, fetched } = await load();
    const normalized = normalizeEntries(entries);
    const upserted = await upsertEntries(client, normalized);
    return {
      source: label,
      fetched,
      upserted,
      skipped: fetched - normalized.length,
      error: null,
    };
  } catch (err) {
    // Isolated failure: record it, keep other sources going, never wipe rows.
    return {
      source: label,
      fetched: 0,
      upserted: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run the full directory sync. Returns per-source counts. `ok` is true unless a
 * source errored (bootstrap should never error, so ok=false signals a live-source
 * problem worth alerting on).
 */
export async function runDirectorySync(opts: { signal?: AbortSignal } = {}): Promise<SyncResult> {
  const ranAt = new Date().toISOString();
  const client = getAdminClient();
  if (!client) {
    return {
      ok: false,
      ranAt,
      upserted: 0,
      skipped: 0,
      sources: [{ source: "config", fetched: 0, upserted: 0, skipped: 0, error: "Supabase service role not configured" }],
    };
  }

  const results: SyncSourceResult[] = [];

  // 1. Bootstrap (always).
  results.push(await runOne(client, "bootstrap", async () => ({
    entries: BOOTSTRAP_ENTRIES,
    fetched: BOOTSTRAP_ENTRIES.length,
  })));

  // 2 + 3. Government sources - only attempted when a real key exists, so we do
  // not spend the run hammering an endpoint that will 403 with the sample key.
  if (hasRealDataGovKey()) {
    for (const src of GOV_SOURCES) {
      results.push(
        await runOne(client, src.label, () => fetchGovSource(src, { signal: opts.signal }))
      );
    }
  } else {
    for (const src of GOV_SOURCES) {
      results.push({
        source: src.label,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        error: "skipped: DATA_GOV_IN_API_KEY not set (bootstrap in use)",
      });
    }
  }

  const upserted = results.reduce((n, r) => n + r.upserted, 0);
  const skipped = results.reduce((n, r) => n + r.skipped, 0);
  // A "skipped: no key" note is expected pre-launch and does not mean failure.
  const ok = results.every((r) => !r.error || r.error.startsWith("skipped:"));

  return { ok, ranAt, upserted, skipped, sources: results };
}
