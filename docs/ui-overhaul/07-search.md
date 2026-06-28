# 07 - Top-Bar Search Overhaul

Area owner: the AppShell top-bar search box, the explore search experience, the search data layer, and a new instant command-palette style search dropdown.

Scope files:
- `components/layout/AppShell.tsx` (the broken top-bar form, lines 146-158)
- `lib/db/social.ts` (`searchAll`, lines 392-417)
- `app/(app)/explore/actions.ts` (`searchAction`)
- `app/(app)/explore/page.tsx` (explore page, does not read `?q=`)
- `components/composite/ExploreSearch.tsx` (the explore-page search UI)
- New: `components/search/GlobalSearch.tsx`, `components/search/SearchResults.tsx`, `lib/db/search.ts` (or extend `social.ts`)
- Relevance engine to extend: `lib/ranker/*`, `lib/db/feed.ts` (`buildInterestTsQuery`, lines 26-34)
- DB: `supabase/migrations/*` (FTS `search_tsv` + `pg_trgm` trigram indexes already exist; one new migration adds `websearch`/prefix RPCs and a hashtags trigram index)

This is a PLAN only. No app code is edited here.

Route facts confirmed (search result links must target these exact segments):
- People -> `/u/[handle]` (`app/u/[handle]/page.tsx`)
- Posts -> `/p/[short_id]` (`app/p/[short_id]/page.tsx`)
- Projects (collabs) -> `/c/[short_id]` (`app/c/[short_id]/page.tsx`)
- Hashtags -> `/t/[tag]` (`app/(app)/t/[tag]/page.tsx`)

---

## 1. CURRENT STATE (what exists, what is broken / dead / fake)

### 1a. The top-bar search is fully BROKEN end to end (the headline bug)

`AppShell.tsx:146-158` renders a plain HTML form:

```
<form action="/explore" ...>
  <button type="submit" aria-label="Search">...</button>
  <input name="q" placeholder="Search people, posts, projects" .../>
</form>
```

Submitting it does a full-page GET navigation to `/explore?q=<text>`. But the explore page **never reads the `q` param**:

- `ExplorePage` (`app/(app)/explore/page.tsx:40`) has no `searchParams` argument at all. It renders a `<ExploreSearch />` whose internal state starts at `const [query, setQuery] = useState("")` (`ExploreSearch.tsx:13`), seeded empty and never hydrated from the URL.

So the actual behaviour today is: type in the top bar, press Enter, the page reloads to `/explore?q=...`, and the search box on the explore page shows **empty** with **no results**. The query is silently dropped. From the user's point of view the top-bar search does nothing. This is the broken behaviour to fix.

Secondary defects in that same form:
- It is a non-JS round-trip GET. There is no dropdown, no instant results, no keyboard nav, no loading or empty state. It does not match any modern product (LinkedIn / X / Notion all show an instant results panel as you type).
- The clickable submit affordance is the magnifier (`AppShell.tsx:150`); pressing Enter in the input also submits. Both lead to the dead `/explore?q=` path.
- On mobile this top bar is the ONLY search entry point (the explore page is a separate tab), so mobile search is also dead.

### 1b. `searchAll` works but is thin, unranked, and has real gaps

`searchAll(query, limit=20)` in `social.ts:392-417` is the only search query path and it does run, but:

- **No ranking and no relevance ordering.** Each of the four queries is `.limit(limit)` with **no `.order(...)`** (`social.ts:405-408`). Postgres returns rows in physical/index order, so "Aman" might rank below "Amandeep Singh Aman" arbitrarily. There is no `ts_rank`, no prefix boosting, no "matches handle exactly" boost, no engagement boost, no viewer-affinity (same college / followed / connected). The app already has a real relevance stack (`lib/ranker/*`, `buildInterestTsQuery` in `feed.ts:26-34`) and search ignores all of it.
- **`textSearch` requires whole-word `simple` tokens, so it does NOT do prefix / type-ahead matching.** The `tsv` columns are built with `to_tsvector('simple', ...)` (`0001_init.sql:42-44, 87-88`) and the query is joined with `&` (`social.ts:399`). Typing "ash" will NOT match a profile named "Ashpreet" until the whole word "ash" is a token. For a type-ahead box this is wrong - users expect "ash" to surface "Ashpreet" on the third keystroke. (pg_trgm indexes exist on `posts.body` and `profiles.name` per `0025_semantic_behavior_engine.sql:35-36`, but `searchAll` never uses them.)
- **No typo tolerance.** `pg_trgm` is installed and trigram GIN indexes exist (`0025:35-36`), yet `searchAll` uses only exact `tsv` matching. "Ashok" with one typo "Ashpk" returns nothing even though the infra to fix it is already in the DB.
- **Posts result carries no author and no date** (`social.ts:406` selects `id, short_id, body, author_id` only). The UI then renders just the body text (`ExploreSearch.tsx:107`), so a matched post is a context-free snippet - you cannot tell who wrote it or when. World-class post results show author + avatar + timestamp.
- **Projects are not filtered for visibility.** `social.ts:407` selects projects with no `status` filter and no `deleted_at`/closed filter, so closed/delivered projects appear as live search hits. Compare `listOpenProjects` which filters `status='open'`.
- **Hashtag search is `ilike('%q%')`** (`social.ts:408`) ordered arbitrarily, not by `use_count`. A search for "ai" can surface a one-use tag above "#ai" with 4,000 uses. It also has no `.order("use_count", desc)`.
- **Privacy honoured for people (good), not consistently elsewhere.** People query correctly excludes `privacy->>searchable = false`, `deleted_at`, `suspended_at` (`social.ts:405`) - keep this. Posts only filter `deleted_at`; that is acceptable but should also drop expired posts (`expires_at`) to match `/t/[tag]` behaviour (`t/[tag]/page.tsx` filters `expires_at`).

### 1c. The explore-page search (`ExploreSearch.tsx`) is decent but duplicated and disconnected

`ExploreSearch.tsx` is actually a reasonable debounced (300ms) client search with `useTransition` and section results (`ExploreSearch.tsx:18-33`). But:
- It is **not wired to the top bar** (1a) - it never reads `?q=`, so a top-bar submit lands on a blank box.
- It **duplicates** the search UI that the top bar should own. We will have two search experiences that look different (the top-bar pill vs this full-width box) and behave differently. World-class apps have ONE search component reused in both places.
- Results are inline blocks on the page, not a floating dropdown, so it cannot be the model for the top-bar instant panel.
- Placeholder mismatch: top bar says "Search people, posts, projects" (`AppShell.tsx:155`); explore box says "Search people, projects, hashtags..." (`ExploreSearch.tsx:51`). Inconsistent vocabulary.

### 1d. Perceived latency / optimistic gaps

- Every keystroke path runs a server action (`searchAction` -> `searchAll`, 4 round-trip queries) with a 300ms debounce (`ExploreSearch.tsx:24`). There is no client cache, so deleting a character and retyping it re-runs the full 4-query fan-out. Repeated/related queries should be cached in memory.
- The top-bar path has the worst latency of all: it is a full document navigation (`action="/explore"`), then `ExplorePage` does FOUR awaited server queries (`explore/page.tsx:41-46`: `listOpenProjects`, `getPopularFeed(40)`, `getSuggestedConnections`, `getCollegeLeaderboard`) before first paint - none of which is the search the user asked for. So the user waits ~1s for a page that does not even contain their results.
- No prefetch of the destination routes on result hover, so clicking a result is another cold navigation.

### 1e. Contrast / honesty notes specific to search (see also section 5)

- Placeholder text uses `placeholder:text-ash` on `bg-paper` (`AppShell.tsx:156`, `ExploreSearch.tsx:52`). `#5A6A86` on `#FFFFFF` is ~4.7:1 - passes AA for body, but placeholder text is the lowest-priority text and is fine; the live typed text uses `text-ink` (good, high contrast).
- "Searching..." indicator is `text-ash` on paper (`ExploreSearch.tsx:55-57`) - acceptable, but a spinner + skeleton rows read better than low-emphasis text.
- No fake data anywhere in current search - it queries real tables. The dishonesty is purely the dead top-bar wiring (1a), which promises a search that returns nothing.

---

## 2. TARGET (what world-class + real looks like)

Reference systems:
- **Notion / Linear command palette**: instant dropdown under the input, grouped sections, full keyboard nav (Up/Down across groups, Enter to open, Esc to close), highlighted active row, "no results" and "type to search" states, recent searches when empty.
- **LinkedIn global search**: grouped People / Posts / Companies/Projects / Hashtags, each row with avatar/icon + secondary line, a "See all results for X" footer that navigates to the full results page, prefix + fuzzy matching so results appear on the 2nd-3rd keystroke.
- **X (Twitter) search**: people first, top match boosted, trending/recent when the box is empty and focused.

Concretely for Collab47, the new top-bar search is a single reusable `GlobalSearch` component that:

1. Shows an **instant results dropdown** the moment you type (debounced 150-200ms, not 300), grouped into People / Posts / Projects / Hashtags, each capped (e.g. 4 people, 3 posts, 3 projects, 4 hashtags) with the best matches first.
2. Is **ranked**: exact-handle / starts-with / whole-word / fuzzy tiers, then within-tier boosts for viewer affinity (same college, already followed/connected) for people, and `use_count` for hashtags, `like_count + recency` for posts, `status='open' + deadline` for projects. This reuses the same relevance philosophy as `lib/ranker/*` (a small weighted scalarisation per result type, with a `reason` like "same college" mirroring `score.ts:69-80`).
3. Has **prefix + typo tolerance**: prefix via `tsv` `to_tsquery('term:*')` and fuzzy fallback via `pg_trgm` `similarity()` (both already indexed), so "ash" -> "Ashpreet" by keystroke 3 and "ashpk" still finds "Ashok".
4. Has **full keyboard navigation**: focus the input (also via a `Cmd/Ctrl+K` shortcut), arrow Down/Up moves a highlighted active row across all groups, Enter opens the active row (or, if none highlighted, runs "see all results"), Esc clears/closes, Tab moves focus out.
5. Has **correct links**: `/u/[handle]`, `/p/[short_id]`, `/c/[short_id]`, `/t/[tag]`, all confirmed to exist, plus a footer "See all results for X" -> `/explore?q=X` which now actually renders results.
6. Has proper **empty / loading / no-results states**: focused + empty -> recent searches (localStorage) + trending hashtags; typing + in-flight -> skeleton rows; typing + zero hits -> "No results for X. Try a name, @handle, #tag, or project."
7. Feels **optimistic and instant**: an in-memory LRU cache keyed by normalised query so backtracking is free; result rows `prefetch` their destination on hover; the dropdown opens instantly with cached/skeleton content and never blocks on the network.
8. Is **reused on the explore page**: the dedicated explore results page (`/explore?q=`) renders the SAME ranked data via a full-page results layout, and the inline `ExploreSearch` is replaced by (or thin-wraps) the shared component, eliminating the duplication in 1c.

---

## 3. STEP-BY-STEP PLAN

### Step 0 - Database: prefix + fuzzy search RPCs and a hashtag trigram index (one migration)

Create `supabase/migrations/0027_search_rpcs.sql`. The FTS `search_tsv` columns and `pg_trgm` already exist; we add (a) a trigram index for hashtags, and (b) `SECURITY INVOKER` SQL functions that do tiered prefix+fuzzy ranking server-side so RLS still applies and we do one round trip per type instead of four ad-hoc PostgREST calls.

```sql
-- 0027_search_rpcs.sql  (repo record; apply via Management API like prior migrations)
create extension if not exists pg_trgm;

-- hashtags fuzzy/prefix
create index if not exists hashtags_tag_trgm_idx
  on public.hashtags using gin (tag gin_trgm_ops);
create index if not exists profiles_handle_trgm_idx
  on public.profiles using gin (handle gin_trgm_ops);

-- People search: prefix (tsv :*) OR fuzzy (trigram), ranked.
create or replace function public.search_people(q text, lim int default 6)
returns table (id uuid, handle text, name text, avatar_url text,
               college text, branch text, rank real)
language sql stable as $$
  with terms as (
    select string_agg(t || ':*', ' & ') as pref
    from regexp_split_to_table(lower(trim(q)), '\s+') as t
    where length(t) > 0
  )
  select p.id, p.handle, p.name, p.avatar_url, p.college, p.branch,
    -- tiered score: exact handle > handle prefix > tsv rank > trigram sim
    (case when lower(p.handle) = lower(q) then 3.0
          when lower(p.handle) like lower(q) || '%' then 2.0 else 0 end)
    + coalesce(ts_rank(p.search_tsv, to_tsquery('simple', (select pref from terms))), 0)
    + greatest(similarity(p.name, q), similarity(p.handle, q)) as rank
  from public.profiles p, terms
  where p.deleted_at is null and p.suspended_at is null
    and coalesce(p.privacy->>'searchable','true') <> 'false'
    and (
      p.search_tsv @@ to_tsquery('simple', terms.pref)
      or p.name % q or p.handle % q              -- trigram similarity threshold
    )
  order by rank desc
  limit lim;
$$;

-- Posts search: prefix tsv + recency/engagement boost, with author join.
create or replace function public.search_posts(q text, lim int default 4)
returns table (id uuid, short_id text, body text, created_at timestamptz,
               like_count int, author_handle text, author_name text,
               author_avatar text, rank real)
language sql stable as $$
  with terms as (
    select string_agg(t || ':*', ' & ') as pref
    from regexp_split_to_table(lower(trim(q)), '\s+') as t where length(t) > 0
  )
  select po.id, po.short_id, po.body, po.created_at, po.like_count,
         a.handle, a.name, a.avatar_url,
         ts_rank(po.search_tsv, to_tsquery('simple', (select pref from terms)))
           + ln(1 + po.like_count) * 0.05
           - extract(epoch from (now() - po.created_at))/864000.0 * 0.01 as rank
  from public.posts po
  join public.profiles a on a.id = po.author_id
  , terms
  where po.deleted_at is null
    and (po.expires_at is null or po.expires_at > now())
    and po.search_tsv @@ to_tsquery('simple', terms.pref)
  order by rank desc
  limit lim;
$$;

-- Projects search: open first, by deadline.
create or replace function public.search_projects(q text, lim int default 4)
returns table (id uuid, short_id text, title text, brief text,
               status text, deadline date, rank real)
language sql stable as $$
  with terms as (
    select string_agg(t || ':*', ' & ') as pref
    from regexp_split_to_table(lower(trim(q)), '\s+') as t where length(t) > 0
  )
  select pr.id, pr.short_id, pr.title, pr.brief, pr.status, pr.deadline,
         ts_rank(pr.search_tsv, to_tsquery('simple', (select pref from terms)))
           + (case when pr.status = 'open' then 0.5 else 0 end) as rank
  from public.projects pr, terms
  where pr.search_tsv @@ to_tsquery('simple', terms.pref)
  order by rank desc
  limit lim;
$$;

-- Hashtags: prefix + fuzzy, ranked by use_count.
create or replace function public.search_hashtags(q text, lim int default 6)
returns table (tag text, use_count int, rank real)
language sql stable as $$
  select h.tag, h.use_count,
         (case when h.tag like lower(regexp_replace(q,'^#','')) || '%' then 1.0 else 0 end)
           + similarity(h.tag, lower(regexp_replace(q,'^#',''))) as rank
  from public.hashtags h
  where h.tag % lower(regexp_replace(q,'^#',''))
     or h.tag like lower(regexp_replace(q,'^#','')) || '%'
  order by rank desc, h.use_count desc
  limit lim;
$$;
```

Notes:
- All functions are `stable` and run under the caller (default `SECURITY INVOKER`), so RLS on `profiles`/`posts`/`projects` still applies. People privacy + soft-delete filters are inlined.
- Set the trigram threshold with `set_limit(0.2)` or use the `%` operator's session default; document that the default 0.3 may be loosened to 0.2 for short campus names. (Open question 6c.)
- `to_tsquery('simple', 'ash:* & pratap:*')` gives prefix matching. The `terms` CTE builds that safely from sanitised tokens (mirrors `buildInterestTsQuery`, `feed.ts:26-34`).

### Step 1 - Rewrite the search data layer: `lib/db/search.ts`

Create `lib/db/search.ts` (move search out of `social.ts`; leave a re-export shim in `social.ts` if anything imports `searchAll`). Define a single, typed, ranked entry point:

```ts
export interface SearchPerson { id; handle; name; avatar_url; college; branch; reason?: string; }
export interface SearchPost   { id; short_id; body; created_at; like_count;
                                author: { handle; name; avatar_url }; }
export interface SearchProject { id; short_id; title; brief; status; }
export interface SearchHashtag { tag; use_count; }
export interface SearchResults {
  people: SearchPerson[]; posts: SearchPost[];
  projects: SearchProject[]; hashtags: SearchHashtag[];
  query: string;
}

export async function searchAll(query: string, opts?: { compact?: boolean }): Promise<SearchResults>
```

Implementation:
1. Normalise + guard the query exactly like `social.ts:399` (keep Unicode letters/numbers; bail on empty). Lowercase for the RPC.
2. Fan out in parallel via the four RPCs:
   `sb.rpc("search_people", { q, lim: opts?.compact ? 5 : 12 })`, etc.
3. **Viewer-affinity re-rank for people** (the part that reuses the ranker philosophy): after RPC returns people, fetch the viewer's `college`/`branch` once and the viewer's follow/connection sets via the existing `getRelationshipStates`-style lookup, then apply a small post-rank boost: `+0.5 same college`, `+0.3 same branch`, `+0.4 already-followed/connected` (so people you know float up, like X's "top"), and attach a `reason` string ("same college", "you follow them") in the spirit of `score.ts:69-80`. Keep this O(n) over the <=12 returned rows - no extra heavy queries.
4. Return typed, link-ready rows. Posts now include author (fixes 1b). Projects include `status`. Hashtags ordered by `use_count`.
5. Add an in-process micro-cache (Map keyed by normalised query, ~30s TTL, capped 50 entries) so repeated identical server-action calls are cheap. (Client also caches; see Step 4.)

Keep `searchAll`'s name so the explore action keeps working; bump its default richness.

### Step 2 - Server action used by both the dropdown and the explore page

`app/(app)/explore/actions.ts`:
```ts
"use server";
import { searchAll } from "@/lib/db/search";
export async function searchAction(query: string) {
  return searchAll(query, { compact: true }); // dropdown: few rows per group
}
export async function searchAllAction(query: string) {
  return searchAll(query); // explore full page: more rows per group
}
```

### Step 3 - New shared `GlobalSearch` dropdown component

Create `components/search/GlobalSearch.tsx` (`"use client"`). This replaces the dead `<form action="/explore">` in `AppShell.tsx:146-158`. Behaviour:

- Controlled input; the pill styling is lifted from the current form (`AppShell.tsx:147-157`) so the visual stays the same (border-bone, bg-paper, rounded-full, focus-within saffron) but now drives a dropdown.
- Debounce 180ms. On change, check client cache (Step 4) first; if hit, render instantly; else `startTransition(() => searchAction(q))`.
- Renders a floating panel (`absolute` under the input, `z-50`, `bg-paper`, `border-bone`, `shadow-lg`, `rounded-2xl`, `max-h-[70vh] overflow-auto`) using a new `components/search/SearchResults.tsx` for the grouped rows.
- Groups (in this order, each with a small caption header reusing `.text-caption`): People, Posts, Projects, Hashtags. Each row:
  - Person: `Avatar size="sm"` + name (`text-ink` semibold) + `@handle . college` (`text-ash`), `reason` chip if present. Links `/u/${handle}`.
  - Post: small `Avatar` of author + author name + relative time + 2-line `line-clamp-2` body (`text-ink`). Links `/p/${short_id}`.
  - Project: `Briefcase` icon + title (`text-ink` semibold) + 1-line brief (`text-ash`) + status `Tag`. Links `/c/${short_id}`.
  - Hashtag: `Tag variant="saffron"` `#tag` + `use_count` posts. Links `/t/${tag}`.
- Footer row: "See all results for "{q}"" -> `Link href={/explore?q=${encodeURIComponent(q)}}`. Pressing Enter with no highlighted row triggers this.
- **Keyboard nav**: maintain a flat list of all visible result links in render order with an `activeIndex`. `ArrowDown`/`ArrowUp` move and scroll-into-view; `Enter` navigates active (router.push) or footer; `Esc` closes/clears; clicking outside (a `useEffect` document listener or a backdrop) closes. Add `role="combobox"`/`aria-expanded`/`aria-activedescendant` and `role="listbox"`/`role="option"` for a11y.
- **Cmd/Ctrl+K** global listener focuses the input and opens the panel (Notion/Linear convention). Show a subtle "⌘K" hint chip on the right of the pill on desktop.
- **Empty + focused**: show "Recent" (from localStorage, see Step 4) and "Trending" hashtags (a tiny `search_hashtags` call with empty -> top by `use_count`, or pass the top trending tags down from a server prop). "No results" and skeleton states per section 2.7.
- On result click, push the recent query into localStorage and close.

Wire it into `AppShell.tsx`: replace the `<form>...<input/></form>` block (lines 146-158) with `<GlobalSearch className="min-w-0 flex-1 md:max-w-md" recentTrending={...} />`. Keep the surrounding layout untouched. Pass nothing server-only that breaks the existing client `AppShell` (it is already `"use client"`).

### Step 4 - Client cache + recent searches (optimistic feel)

Create `lib/search/clientCache.ts`:
- An in-memory `Map<string, SearchResults>` LRU (cap ~40) used by `GlobalSearch` so backspacing/retyping a previous query is instant (no spinner, no network).
- Recent searches: `lib/search/recent.ts` reading/writing `localStorage` (mirror the pattern in `lib/newsPersonalize.ts:38-44` - guarded `safeParse`, no DB). Store last ~6 raw queries; render them in the empty-focused state as quick chips that refill the input.
- On hover of any result row, call `router.prefetch(href)` so the click navigation is warm.

### Step 5 - Make `/explore?q=` actually render results (full results page)

`app/(app)/explore/page.tsx`:
- Add `searchParams` and read `q`:
  ```ts
  export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q } = await searchParams;
    ...
  }
  ```
- If `q` is present and non-empty: render a **full search-results view** (server-rendered for the initial paint using `searchAll(q)` directly, then the shared client `ExploreSearch` hydrated WITH the initial `q` and initial results so it is instant and editable). Show grouped, paginated-ish sections (more rows than the dropdown), with the same row components as the dropdown (extract shared row renderers into `components/search/SearchResults.tsx` so explore and dropdown share them).
- If `q` is absent: render the existing discover view (featured / trending / suggested / leaderboard) unchanged.

`components/composite/ExploreSearch.tsx`:
- Accept `initialQuery?: string` and `initialResults?: SearchResults` props; seed `useState(initialQuery ?? "")` and `useState(initialResults ?? null)` so a top-bar submit lands on a populated, editable box (fixes 1a/1c).
- Reduce debounce to 180ms to match the dropdown; read from the same client cache.
- Add author + timestamp to the post rows (consume the now-richer `SearchPost`), and a status `Tag` to project rows. Order hashtags by `use_count`.
- Replace the bespoke section markup with the shared `SearchResults` renderers where practical.

### Step 6 - Visibility + correctness fixes carried into the data layer

- Projects: filter to non-closed for search defaults (or show a "Closed" tag honestly rather than hiding) - decide via Open Question 6b. RPC currently boosts `open` to the top; if we want closed hidden entirely add `and pr.status in ('open','team_formed','in_progress')`.
- Posts: drop expired (`expires_at`) - already in the RPC `where`.
- People: privacy/soft-delete/suspended already enforced in the RPC.

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

- **Instant open**: the dropdown panel opens on focus immediately with recent/trending (no network), and on the first keystroke shows skeleton rows while the 180ms-debounced action is in flight. The user never stares at a frozen box.
- **Client LRU cache** (Step 4): backspacing into a previously typed query renders from memory with zero latency - directly addresses the "1s to register" complaint, since most type-ahead traffic is re-typing prefixes.
- **Server micro-cache** (Step 1.5): identical concurrent queries (e.g. two devices, or rapid duplicate actions) reuse the same result within ~30s.
- **One round trip per type** via RPCs instead of four ad-hoc PostgREST queries, and `Promise.all` across the four RPCs - same wall-clock as today but each is index-backed (tsv GIN + trigram GIN already exist), so faster per call.
- **Prefetch on hover** warms the destination route so clicking a result feels instant (client cache + RSC payload prefetched).
- **Top-bar no longer does a full-document navigation** for the common case; results appear inline. The full `/explore?q=` navigation only happens on "See all" / Enter-with-no-selection, and that page now server-renders results in its first paint instead of four unrelated discover queries.
- Debounce tuned to 180ms (down from 300ms in `ExploreSearch.tsx:24`) - fast enough to feel live, slow enough to avoid a request per keystroke.

## 5. HONESTY + CONTRAST NOTES

- **Honesty**: the single biggest dishonesty is the dead top-bar search (1a) - it presents a working search affordance that returns nothing. The plan makes it real end to end. No mock/synthetic results anywhere; every row is a real DB row via RLS-respecting RPCs.
- **Projects**: showing closed/delivered projects as live hits (1b) is misleading; either hide them or label status honestly with a `Tag` (Open Question 6b). No silent hiding without a label.
- **Contrast** (cobalt tokens):
  - All result primary text uses `text-ink` (#0A0F1C) on `bg-paper` (#fff) - maximal contrast. Secondary lines use `text-ash` (#5A6A86, ~4.7:1 on white, AA) - acceptable; do NOT drop below `text-ash` and never use `text-ash` on a tinted/`/60` background in the dropdown (keep the panel solid `bg-paper`, not translucent, so contrast is stable).
  - The active/highlighted keyboard row must be clearly visible: use `bg-cream` or `bg-saffron/10` with `text-ink` (never a faint `/5` tint that disappears). The current explore rows use `card-hover`/`hover:bg-cream` which is fine for hover but the keyboard-active state needs an explicit, always-visible style.
  - The "⌘K" hint chip and "Searching..." text must be at least `text-ash`; prefer a small spinner over low-emphasis grey text for the loading state.
  - Placeholder `placeholder:text-ash` (`AppShell.tsx:156`) is fine; the live typed value is `text-ink` (high contrast) - keep that.
  - No saffron text on saffron, no ash-on-ash. Hashtag `Tag variant="saffron"` is `bg-saffron/10 text-saffron-dk` (`Tag.tsx`) which is high-contrast - keep it.

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. **Scope of "posts" in search**: should the top-bar dropdown include posts at all, or focus on People + Projects + Hashtags (LinkedIn surfaces posts only under "See all")? Posts in a tiny dropdown can be noisy. Proposal: show 2 top posts in the dropdown, full posts on `/explore?q=`.
2. **Closed projects**: hide non-open projects from search entirely, or show them with an honest "Closed/Delivered" `Tag`? Proposal: show with a status tag (honest, and useful for finding past work).
3. **Trigram threshold**: default `pg_trgm` similarity is 0.3; campus names and short handles may need 0.2 for good typo tolerance. OK to set `pg_trgm.similarity_threshold = 0.2` for search RPCs? Trade-off: more fuzzy matches vs occasional noise.
4. **Cmd/Ctrl+K shortcut**: confirm we want the keyboard shortcut + the "⌘K" hint chip in the top bar (it adds a power-user affordance; some founders prefer a cleaner bar).
5. **Recent searches storage**: localStorage only (private, no DB, matches `newsPersonalize`), or persist server-side per user for cross-device recents? Proposal: localStorage now, server-side later if asked.
6. **"See all" destination**: keep `/explore?q=` as the full results page (reuses the explore route), or introduce a dedicated `/search?q=` route? Proposal: reuse `/explore?q=` to avoid a new route and keep the existing search box co-located with discovery.
7. **Mentions / people-first bias**: should typing `@ash` restrict to people only, and `#ai` restrict to hashtags only (X/Slack convention)? Easy to add as a prefix detector in `GlobalSearch`. Confirm desired.
