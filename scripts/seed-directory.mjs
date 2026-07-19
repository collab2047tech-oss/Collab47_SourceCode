// ===========================================================================
// One-shot local seeder for public.directory_entries. Loads the SAME data the
// runtime sync loads (lib/directory/bootstrap.json), plus the data.gov.in
// government sources when DATA_GOV_IN_API_KEY is set - so the directory has real
// rows BEFORE any cron runs or API key exists.
//
// Prereq: apply supabase/migrations/0055_directory.sql first (orchestrator does).
// Run:    node scripts/seed-directory.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ optional
// DATA_GOV_IN_API_KEY / DATA_GOV_IN_AISHE_RESOURCE / DATA_GOV_IN_DPIIT_RESOURCE)
// from .env.local. UPSERT-only: safe to re-run; never truncates.
//
// This mirrors lib/directory/{sync,sources,normalize}.ts in plain JS because a
// .mjs script cannot import the app's TypeScript. Keep the two in sync.
// ===========================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SRK) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
const sb = createClient(URL_, SRK, { auth: { persistSession: false } });

const SAMPLE_KEY = "579b464db66ec23bdd000001cdd3946e44ce396f6ec19b3255ba7f9d";
const DATA_GOV_KEY = (env.DATA_GOV_IN_API_KEY || "").trim();
const HAS_REAL_KEY = Boolean(DATA_GOV_KEY && DATA_GOV_KEY !== SAMPLE_KEY);
const UPSERT_BATCH = 500;

// --- normalize (mirror of lib/directory/normalize.ts) --------------------
const collapse = (s) => String(s).replace(/\s+/g, " ").trim();
function normalizeEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    const name = collapse(e.name);
    if (!name) continue;
    map.set(`${e.kind}::${name.toLowerCase()}`, {
      kind: e.kind,
      name,
      city: e.city ? collapse(e.city) : null,
      state: e.state ? collapse(e.state) : null,
      extra: e.extra || {},
      source: e.source,
      source_ref: e.sourceRef || null,
      updated_at: new Date().toISOString(),
    });
  }
  return [...map.values()];
}

async function upsertEntries(entries) {
  let written = 0;
  for (let i = 0; i < entries.length; i += UPSERT_BATCH) {
    const chunk = entries.slice(i, i + UPSERT_BATCH);
    const { error } = await sb.from("directory_entries").upsert(chunk, { onConflict: "kind,name" });
    if (error) throw new Error(error.message);
    written += chunk.length;
  }
  return written;
}

// --- bootstrap source ----------------------------------------------------
function bootstrapEntries() {
  const raw = JSON.parse(readFileSync(new URL("../lib/directory/bootstrap.json", import.meta.url), "utf8"));
  const inst = raw.institutions.map((e) => ({ kind: "institution", name: e.name, city: e.city, state: e.state, source: "bootstrap" }));
  const start = raw.startups.map((e) => ({ kind: "startup", name: e.name, city: e.city, state: e.state, source: "bootstrap" }));
  return [...inst, ...start];
}

// --- government sources (mirror of lib/directory/sources.ts) -------------
const GOV_SOURCES = [
  {
    label: "data.gov.in:aishe-colleges",
    kind: "institution",
    resourceId: (env.DATA_GOV_IN_AISHE_RESOURCE || "48d9c89e-e08b-46f1-b019-96ea5d5b1748").trim(),
    nameKeys: ["institution_name", "name_of_the_institution", "name_of_institution", "college_name", "university_name", "name"],
    cityKeys: ["district_name", "district", "city", "location"],
    stateKeys: ["state_name", "state", "state_ut"],
    extraKeys: ["aishe_code", "type", "management", "university_name"],
  },
  {
    label: "data.gov.in:dpiit-startups",
    kind: "startup",
    resourceId: (env.DATA_GOV_IN_DPIIT_RESOURCE || "b961c317-9fe7-4de2-bc25-9a15b2ec3782").trim(),
    nameKeys: ["company_name", "name_of_the_company", "name_of_company", "startup_name", "entity_name", "name"],
    cityKeys: ["city", "city_name", "location", "district"],
    stateKeys: ["state", "state_name", "state_ut"],
    extraKeys: ["cin", "website", "industry", "sector", "focus_industry", "company_status"],
  },
];

const pick = (row, keys) => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return collapse(v);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
};

async function fetchGovSource(src) {
  const pageSize = 1000;
  const maxRecords = 60000;
  const entries = [];
  let fetched = 0;
  let offset = 0;
  for (;;) {
    const url = `https://api.data.gov.in/resource/${src.resourceId}?api-key=${encodeURIComponent(DATA_GOV_KEY || SAMPLE_KEY)}&format=json&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${src.label}`);
    const body = await res.json();
    if (body.error) throw new Error(`${src.label}: ${body.error}`);
    const records = body.records || [];
    if (records.length === 0) break;
    for (const row of records) {
      fetched += 1;
      const name = pick(row, src.nameKeys);
      if (!name) continue; // skip aggregate / nameless rows
      const extra = {};
      for (const k of src.extraKeys) if (row[k] != null && row[k] !== "") extra[k] = row[k];
      entries.push({ kind: src.kind, name, city: pick(row, src.cityKeys), state: pick(row, src.stateKeys), extra, source: src.label, sourceRef: src.resourceId });
    }
    offset += records.length;
    const total = typeof body.total === "number" ? body.total : Infinity;
    if (offset >= total || offset >= maxRecords || records.length < pageSize) break;
  }
  return { entries, fetched };
}

// --- run -----------------------------------------------------------------
async function runSource(label, loader) {
  try {
    const { entries, fetched } = await loader();
    const normalized = normalizeEntries(entries);
    const upserted = await upsertEntries(normalized);
    console.log(`  ${label}: fetched ${fetched}, upserted ${upserted}, skipped ${fetched - normalized.length}`);
    return { upserted, error: null };
  } catch (err) {
    console.log(`  ${label}: ERROR ${err.message}`);
    return { upserted: 0, error: err.message };
  }
}

async function main() {
  console.log("Seeding directory_entries ...");
  // 1. bootstrap (always)
  await runSource("bootstrap", async () => {
    const entries = bootstrapEntries();
    return { entries, fetched: entries.length };
  });
  // 2 + 3. government sources (only with a real key; override bootstrap on conflict)
  if (HAS_REAL_KEY) {
    for (const src of GOV_SOURCES) await runSource(src.label, () => fetchGovSource(src));
  } else {
    console.log("  data.gov.in sources SKIPPED (DATA_GOV_IN_API_KEY not set - bootstrap only).");
  }

  const { count } = await sb.from("directory_entries").select("*", { count: "exact", head: true });
  console.log(`Done. directory_entries now holds ${count ?? "?"} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
