# Directories: Institutions and DPIIT Startups

Real, continuously-updated reference lists of Indian higher-education
**institutions** and **DPIIT-recognized startups**, powering the onboarding
pickers (institution search today, startup search next). One table, filled from a
curated bootstrap on day one and refreshed nightly from government open data once
an API key is configured.

## How it works

- **Table:** `public.directory_entries` (migration `0055_directory.sql`).
  Columns: `id, kind ('institution'|'startup'), name, city, state, extra jsonb,
  source, source_ref, updated_at`, with `unique (kind, name)`. Trigram GIN index
  on `name` for fuzzy search; btree index on `kind`.
- **RLS:** enabled. `SELECT` is public (anon + authenticated) - this is
  non-sensitive reference data. There is **no** insert/update/delete policy, so
  all writes are denied to normal users; only the service role (cron + seeder,
  which bypass RLS) can write.
- **Sync is UPSERT-only and never truncates.** Sources run in priority order:
  1. `bootstrap` (always) - guarantees data with zero API keys.
  2. `data.gov.in:aishe-colleges` (only with a real key) - overrides bootstrap.
  3. `data.gov.in:dpiit-startups` (only with a real key).
  Each source is isolated in `try/catch`, so one source failing (or a source
  going dark) can only leave existing rows untouched - it can never wipe the
  directory. Government sources run *after* bootstrap so live data wins on the
  `(kind, name)` conflict.

Code map:
- `lib/directory/bootstrap.json` - single source of truth for bootstrap data
  (also read by the `.mjs` seeder, which cannot import TypeScript).
- `lib/directory/{types,normalize,bootstrap,sources,sync,search}.ts` - runtime.
- `app/api/directory/search/route.ts` - public search endpoint.
- `app/api/cron/directory/route.ts` - nightly sync endpoint.
- `scripts/seed-directory.mjs` - one-shot local seeder (mirrors the sync in JS).

## Endpoints

### `GET /api/directory/search` (public)

The onboarding picker contract. Do not change the response shape.

```
GET /api/directory/search?kind=institution|startup&q=<text>
200 { "items": [ { "name": string, "city"?: string, "state"?: string } ] }   // max 12
```

- Ordering: exact match > starts-with > word-boundary starts-with > substring
  (earlier position wins). `city`/`state` are omitted when unknown.
- Empty `q` returns the first 12 by name (a stable browse list).
- Invalid/missing `kind` returns `{ "items": [] }` (never breaks the picker).
- Cached at the edge: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=3600`.

### `GET /api/cron/directory` (secured)

Runs the sync. Same auth as `/api/cron/news`: send `x-cron-secret: <CRON_SECRET>`
(GitHub Action) or Vercel's built-in `Authorization: Bearer <CRON_SECRET>`.
Returns per-source counts:

```
200 { "ok": true, "ranAt": "...", "upserted": N, "skipped": N,
      "sources": [ { "source", "fetched", "upserted", "skipped", "error" }, ... ] }
```

`ok` is `false` (HTTP 500) if a live source errored; a "skipped: no key" note is
expected pre-launch and does **not** count as failure.

## Refresh cadence

- Vercel cron: `/api/cron/directory` at `0 2 * * *` (daily 02:00 UTC), added to
  `vercel.json`. This means a newly recognized startup or newly listed college
  appears within ~24h of the government dataset publishing it.
- **Caveat:** DPIIT *recognition* itself lags company incorporation by weeks, and
  data.gov.in refreshes its datasets on its own (often weekly/periodic) schedule.
  So "a startup created today shows up tomorrow" is bounded by how fast the
  *source* updates, not by our cron. Our cron is the fast part.

## Data source verdict (verified 2026-07-19)

**Endpoint shape (correct):**
`https://api.data.gov.in/resource/<resourceId>?api-key=<key>&format=json&offset=<n>&limit=<n>`
returns `{ records: [...], total, count, ... }`.

| What | Result |
| --- | --- |
| Public **sample** api-key `579b464db66ec23bdd0000018...` | **BLOCKED** - `HTTP 403 {"error":"Key not authorised"}` today, for every resource. Cannot pull live data with it. |
| AISHE list-of-colleges resource `48d9c89e-e08b-46f1-b019-96ea5d5b1748` | Real resource id (confirmed from the catalog page). Returns data only with a valid key. |
| DPIIT startups resource `b961c317-9fe7-4de2-bc25-9a15b2ec3782` | Real resource id, but this open dataset is **aggregate counts** (year / state / industry / number-of-startups), **not** a per-company name list. Our mapper skips nameless rows, so it contributes nothing until pointed at a genuine per-startup resource. |

**Bottom line:** live government data is **key-blocked** right now. Everything is
built and wired around `DATA_GOV_IN_API_KEY`; the moment the founder sets a real
key, the nightly sync pulls AISHE institutions live with zero code changes. Until
then the **bootstrap** is the live data and the pickers work fully.

## Bootstrap contents

`lib/directory/bootstrap.json` (regenerate-safe, real data only - nothing invented):

- **155 institutions** - the app's existing curated list of real Indian
  institutions (IITs, NITs, IIITs, IISERs, IIMs, AIIMS, central/state/deemed/
  private universities and top colleges), with HQ city + state.
- **216 startups** - real, verifiable DPIIT-recognized Indian companies
  (Flipkart, Zomato, Razorpay, Zerodha, Skyroot Aerospace, ...), each with HQ
  city + state. No invented entries.

City/state are filled only where confidently known.

## Going fully live (what the founder must do)

1. Register a free account at <https://data.gov.in> (Sign Up).
2. Log in, open your profile - **"My Account" -> "API Key"** shows a personal API
   key (a ~40-char token). Generation is free and instant.
3. Add it to the environment (local `.env.local` and Vercel project env):
   ```
   DATA_GOV_IN_API_KEY=<your key>
   ```
4. (Optional) override resource ids if you find better datasets:
   ```
   DATA_GOV_IN_AISHE_RESOURCE=<uuid>   # institutions (default: AISHE colleges)
   DATA_GOV_IN_DPIIT_RESOURCE=<uuid>   # per-STARTUP list (default is aggregate-only)
   ```
   To get a real per-startup list (name + city + CIN), find a per-company DPIIT
   resource on data.gov.in and set `DATA_GOV_IN_DPIIT_RESOURCE` to its resource id;
   the mapper already looks for `company_name` / `city` / `cin` fields.
5. Re-run `node scripts/seed-directory.mjs` once (or wait for the nightly cron) to
   pull the live datasets. Existing bootstrap rows are upserted/overridden, never
   wiped.

No paid services are used anywhere in this feature.

## Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | DB access for sync/seed (already configured). |
| `CRON_SECRET` | yes | Authorizes `/api/cron/directory` (already configured, shared with other crons). |
| `DATA_GOV_IN_API_KEY` | no (bootstrap works without it) | Unlocks live data.gov.in pulls. |
| `DATA_GOV_IN_AISHE_RESOURCE` | no | Override the institutions resource id. |
| `DATA_GOV_IN_DPIIT_RESOURCE` | no | Override the startups resource id. |
