# 03 - Feed UX Overhaul (Infinite scroll, tabs, filters, right-rail)

Area owner scope: the `/home` feed surface. Files: `app/(app)/home/page.tsx`,
`components/composite/HomeFeed.tsx`, `components/composite/FeedFilters.tsx`,
`components/composite/FeedTracker.tsx`, `lib/db/feed.ts`, `lib/ranker/*`,
`app/(app)/home/feedback-actions.ts`.

Reference systems: LinkedIn home feed (cursor pagination, single ranked stream
with sort toggle), Twitter/X (For you vs Following tabs, instant tab switch),
Instagram (optimistic interactions, prefetch on tab focus).

---

## 1. CURRENT STATE (what exists, what is broken / dead / fake)

### 1a. No infinite scroll - fixed N, full preload of 4 feeds

- `app/(app)/home/page.tsx:31-40` fetches FOUR feeds in parallel at page load,
  each capped at 20 rows: `getForYouFeed(20)`, `getRecentFeed(20)`,
  `getPopularFeed(20)`, `getTrendingFeed(20)`. All 4 arrays are passed to
  `HomeFeed` as props.
- `components/composite/HomeFeed.tsx:31-32` simply picks one array by tab and
  `PostsTab` (`HomeFeed.tsx:122-155`) renders `posts.map(...)`. There is no
  loader, no `IntersectionObserver` sentinel, no "load more", no cursor. Scroll
  ends at post 20. This is the founder's "feed shows only a limited number of
  posts."
- `lib/db/feed.ts` signatures take only `limit`. There is NO cursor / offset
  parameter on any of the four functions (`getForYouFeed:41`,
  `getRecentFeed:261`, `getPopularFeed:277`, `getTrendingFeed:289`), so
  pagination is impossible without changing signatures.
- Cost smell: every home render runs all 4 ranking pipelines even though the
  user sees one tab. `getForYouFeed` alone fires ~8 Supabase round trips
  (`feed.ts:63-73`, `184-219`) plus a `feed_training` insert (`254`). Popular and
  Trending each pull 120 rows (`feed.ts:283`, `303`). This is a big part of the
  ~1s perceived lag on first paint.

### 1b. The 4 tabs - each query verified, real defects found

For you (`getForYouFeed`, `feed.ts:41-258`): genuinely sophisticated and real
(recall union, taxonomy expansion, BM25 via `search_tsv`, item-CF, personalised
PageRank, velocity, MCDM/neural head, diversity). It works. Its only problems
are (i) `limit` default 12 / called with 20 and no pagination, (ii) it re-runs
on every interaction because every engagement action calls
`revalidatePath("/home")` (see `engagement-actions.ts:15,21,27,37` etc.), which
re-executes this entire heavy pipeline server-side on every like.

Recent (`getRecentFeed`, `feed.ts:261-274`): returns `[]` when the user follows
nobody (`feed.ts:268`). For a new user this tab is permanently empty, which
reads as "broken." LinkedIn/X "Following" is the right model, but new users need
a non-dead state. Also it is reverse-chron of follows ONLY - it never includes
the viewer's own posts, so right after you post, "Recent" can still be empty.

Popular (`getPopularFeed`, `feed.ts:277-286`): last 24h sorted by
`engagementScore`. The bug is `engagementScore` (`feed.ts:21-24`) divides by
`(impressions ?? 30) + 10`. Brand-new posts default to `impressions = 30` even
when `posts.impressions` is null, so a post with 1 like scores `1/40 = 0.025`
regardless of reach. Posts with real high impressions get penalised vs posts
that were never seen. Result: "Popular" is noisy and not actually popular. There
is also no minimum-engagement floor, so a 24h window with little activity shows
near-random ordering.

Trending (`getTrendingFeed`, `feed.ts:289-315`): last 6h, same flawed
`engagementScore` plus a tiny additive branch/city boost (`+0.5` / `+0.3` on
`feed.ts:309-310`). Two problems: (1) it silently falls back to
`getPopularFeed(limit)` when the 6h window is empty (`feed.ts:305`), so Trending
and Popular become identical and feel "broken / duplicated." (2) "Trending"
should measure VELOCITY (engagement acceleration), not raw engagement - the
For-You pipeline already computes a proper `velocity` signal
(`feed.ts:224-229`) but Trending does not reuse it. So the dedicated Trending
tab is weaker than the velocity logic already living in For You.

Tab counts: `HomeFeed.tsx:24-29` shows a numeric badge = array length per tab.
Because each feed is capped at 20, the badge maxes at "20" and is misleading
(implies "20 total posts exist"). X/LinkedIn show no such count.

### 1c. FeedFilters - one fully dead, two cause full reload

`components/composite/FeedFilters.tsx` renders 3 chips: `only_follows`,
`hide_news`, `hide_projects` (`FeedFilters.tsx:18-22`). On toggle it persists via
`updateFeedFiltersAction` (`feedback-actions.ts:33-46`) which writes
`profiles.feed_prefs` and `revalidatePath("/home")`.

- `only_follows`: REAL but redundant. `getForYouFeed` reads it
  (`feed.ts:82-86`, `129-134`) and restricts For-You to follows. But that is
  exactly what the "Recent" tab already is. So the chip duplicates a tab and
  only affects the For-You tab, not Recent/Popular/Trending. Confusing.
- `hide_projects`: REAL but partial. Honored only in `getForYouFeed`
  (`feed.ts:84`, `176`). Popular/Trending/Recent ignore it entirely. So toggling
  it changes one tab and silently does nothing on the others.
- `hide_news`: 100% DEAD. Grep confirms `hide_news` is written
  (`feedback-actions.ts:35,42`) and read for the chip's initial state
  (`page.tsx:208`) but consumed by NOTHING. News appears only in the right rail
  (`page.tsx:164-187` daily brief, plus `peopleCard`/`briefCard`). There are no
  news cards in the feed stream at all, so "Hide news" hides nothing. This is a
  fake control - it must be made real or removed.

Net: founder is right - the buttons are "redundant / not working." Two of three
do something only on one tab; one does nothing anywhere.

### 1d. Right-rail visibility + scroll

- Layout (`page.tsx:189-247`): `max-w-270` wrapper, grid
  `lg:grid-cols-[minmax(0,1fr)_320px]`. Right rail is `<aside className="hidden
  lg:block">` with inner `sticky top-24` (`page.tsx:238-239`).
- AppShell header is `sticky top-0` `h-16` (64px) (`AppShell.tsx:137-138`);
  `<main>` has `pt-6` (`AppShell.tsx:184`). Feed tab bar is `sticky top-16`
  (`HomeFeed.tsx:41`). The rail uses `top-24` (96px), a 32px gap below the
  header - inconsistent with the tab bar's 64px, so the rail and tab bar do not
  align and the rail starts lower than expected.
- "Only visible after scrolling": on `lg`, the rail IS in the grid from the top.
  The reported symptom is that with a short feed the rail content (Trending /
  People / Interests / Brief) sits in the right column but the eye is on the
  centered feed; the rail's `sticky top-24` only engages once you scroll past it,
  and the cards are quiet/low-emphasis. On `< lg` the rail collapses entirely and
  only a slimmed People+Brief block appears BELOW the whole feed
  (`page.tsx:223-232`), i.e. after scrolling past every post. That is the literal
  "only visible after scrolling."
- Scroll "feels broken": two stacked sticky contexts (header `top-0`, tab bar
  `top-16`) plus `Reveal` entrance animations on every card
  (`HomeFeed.tsx:140-149`, staggered up to 0.4s) make long scroll janky and make
  late cards pop in. With no virtualization and `force-dynamic`
  (`page.tsx:22`), nothing is cached between navigations either.

### 1e. Contrast / honesty offenders found in this area

- `page.tsx:172` and `PostCard.tsx:407,411` use `text-bone` for the middot
  separator `&middot;`. `bone` (#DDE3EE) on paper/cream is near-invisible
  (~1.2:1). It is decorative, but currently it is also used as a visible glyph.
- `PostCard.tsx:351` `isPinned && "bg-saffron/2"` - 2% cobalt tint is
  imperceptible; the pinned row is not actually distinguishable.
- Tab count badge inactive state `bg-bone text-ash` (`HomeFeed.tsx:72`): ash
  (#5A6A86) on bone (#DDE3EE) is ~3.0:1, borderline for small 10px text.
- "Fake" surfaces to fix: the `hide_news` chip (does nothing); the Trending tab
  silently mirroring Popular; the tab count badges implying a true total.

---

## 2. TARGET (world-class + 100% real)

Model the home feed on LinkedIn + X:

- ONE infinite, cursor-paginated stream per tab. Scrolling loads the next page
  via an `IntersectionObserver` sentinel near the bottom; a skeleton shows while
  loading; "You are all caught up" terminal state when exhausted (LinkedIn).
- Tab switch is INSTANT: first page of each tab is server-rendered once; tab
  content is cached client-side per session so switching back is immediate
  (X behavior). Further pages stream in on demand.
- Four tabs that are genuinely DISTINCT and correct:
  - For you - personalised ranked stream (already real; add pagination).
  - Recent - reverse-chron of follows + your own posts; new-user fallback to a
    discovery stream so it is never a dead end.
  - Popular - top engagement in 24h using a CORRECT engagement rate (real
    impressions, with a Wilson/Bayesian shrink so low-reach posts do not win by
    accident).
  - Trending - true velocity (engagement acceleration in last 6h) reusing the
    For-You `velocity` signal, branch/city aware, never silently equal to
    Popular.
- Filters that each visibly change the stream across ALL tabs, applied at query
  time, with optimistic re-rank on the client. Remove or rebuild the dead
  `hide_news`.
- Right rail visible immediately on desktop, aligned to the tab bar, with a
  collapsible/secondary presentation on mobile that does not require scrolling
  the whole feed first. Discovery cards (Trending tags, People to follow) should
  use the SAME matching engine as the feed (this connects to the people-to-follow
  and trending plans).

---

## 3. STEP-BY-STEP PLAN

### STEP 0 - DB / data prerequisites

1. Confirm `posts.impressions` is populated. It is fed by
   `bump_impressions` RPC from `recordFeedEventsAction`
   (`feed-events-actions.ts:41`). For Popular/Trending correctness we must stop
   defaulting null impressions to 30.
   - Change `engagementScore` (`feed.ts:21-24`) to a Bayesian/Wilson-shrunk
     rate. New impl:
     ```ts
     // m = prior impressions (global mean reach), C = prior weight.
     function engagementScore(p: PostWithAuthor): number {
       const eng = p.like_count + 2*p.comment_count + 3*p.repost_count + 4*p.bookmark_count;
       const impr = (p as PostWithAuthor & { impressions?: number }).impressions ?? 0;
       const C = 20; // smoothing: until ~20 impressions, regress toward 0
       return eng / (impr + C);
     }
     ```
     This removes the magic `?? 30` that inflates unseen posts and lets real
     reach matter.
2. No new tables strictly required. Pagination uses keyset cursors on existing
   columns:
   - Recent / For-you-by-follows: cursor = `created_at` (already ordered desc).
   - Popular / Trending: these sort by a computed score in JS, so they cannot
     keyset on `created_at`. Plan: paginate Popular/Trending by SCORE-then-id
     within the fetched window (see Step 3). For a 24h/6h window the candidate
     set is bounded (<= a few hundred), so we fetch the window once, rank, and
     page through the ranked array using an opaque offset cursor.
3. Optional (recommended) migration for honest Popular at scale: a materialised
   `post_engagement` view or a `posts.hot_score` column refreshed by the
   existing nightly job, so Popular/Trending can keyset in SQL instead of
   pulling 120 rows. Mark as OPEN QUESTION (worth it only past N posts).

### STEP 1 - Add cursor pagination to `lib/db/feed.ts`

Change all four feed functions to accept and return a cursor. Introduce a shared
type and a single paginated entrypoint so the client has one server action.

1. New file `lib/db/feed-page.ts` (or add to `feed.ts`):
   ```ts
   export type FeedTab = "foryou" | "recent" | "popular" | "trending";
   export interface FeedPage {
     posts: PostWithAuthor[];
     nextCursor: string | null; // opaque; null = exhausted
   }
   export async function getFeedPage(
     tab: FeedTab, cursor: string | null, limit = 12
   ): Promise<FeedPage> { /* dispatch per tab */ }
   ```
2. For-you: thread a cursor through `getForYouFeed`. Because For-You re-ranks a
   recall pool, true keyset is hard. Pragmatic approach used by real systems:
   compute the full ranked list for the session-stable recall window once, cache
   the ordered post-id list in the cursor payload, and page through it. Encode
   cursor as base64 of `{ servedIds: string[], offset: number }` OR simpler:
   exclude already-served ids (passed up from the client) and re-rank remaining
   recall. Recommended: pass `excludeIds` (the ids already on screen) into the
   recall queries via `.not("id","in",(...))` so each page is fresh and
   deduped. Add `excludeIds: string[] = []` param to `getForYouFeed`.
3. Recent: keyset on `created_at`. Add `before?: string` param; query becomes
   `.lt("created_at", before)` when cursor present. `nextCursor` =
   `created_at` of last row. Also UNION the viewer's own posts (see Step 2).
4. Popular / Trending: fetch the time window once (24h / 6h), rank in JS with the
   corrected `engagementScore`, then slice `[offset, offset+limit]`. Cursor =
   `String(offset + limit)`; `nextCursor = null` when offset reaches the ranked
   length. This is honest (the window is finite) and cheap.

### STEP 2 - Fix each tab's correctness

1. Recent (`feed.ts:261-274`):
   - Include the viewer's own posts: add `user.id` to the `ids` array so your
     post appears in Recent immediately after posting.
   - New-user fallback: if `ids.length === 0` (or only self with no posts),
     return a recent-global discovery page instead of `[]`, AND surface an inline
     "You are not following anyone yet - here is what is new" header (handled in
     UI Step 4). Never a dead empty tab.
2. Popular (`feed.ts:277-286`): use corrected `engagementScore` (Step 0) and add
   a minimum signal floor (`like_count + comment_count + repost_count >= 1`) so
   zero-engagement posts never rank as "popular." Keep 24h window.
3. Trending (`feed.ts:289-315`):
   - Replace raw `engagementScore` ranking with VELOCITY. Reuse the For-You
     velocity definition: engagement of posts younger than 6h normalised by the
     window max (`feed.ts:224-229`). Extract that into a shared
     `velocityScore(posts)` helper in `lib/ranker/` and call it here.
   - Keep the branch/city boost but apply it multiplicatively on the velocity
     score, not additively on a different scale.
   - REMOVE the silent fallback to `getPopularFeed` (`feed.ts:305`). If 6h is
     empty, widen to 12h for Trending (still velocity-ranked) and show an honest
     "Quiet right now - showing the last 12 hours" note. Trending must never be
     byte-identical to Popular.
4. Remove misleading tab count badges (`HomeFeed.tsx:24-29,68-77`) OR change them
   to a live "new posts" pill (X-style "N new posts" that appears when newer
   content exists). Recommend: drop the static count; add the "new posts"
   affordance later (out of scope here, note as follow-up).

### STEP 3 - Infinite scroll client (`HomeFeed.tsx`)

Rewrite `HomeFeed` + `PostsTab` to be a paginating client component.

1. New server action `app/(app)/home/feed-page-actions.ts`:
   ```ts
   "use server";
   export async function loadFeedPageAction(
     tab: FeedTab, cursor: string | null, excludeIds: string[]
   ): Promise<{ posts: CardPost[]; nextCursor: string | null }> {
     const page = await getFeedPage(tab, cursor /*, excludeIds for foryou */);
     const ids = page.posts.map(p => p.id);
     const eng = await getMyEngagementState(ids);     // reuse existing
     return { posts: page.posts.map(p => withEng(p, eng)), nextCursor: page.nextCursor };
   }
   ```
   Move the `withEng` mapping out of `page.tsx:48-54` into a shared
   `lib/ui/withEng.ts` so server action and page agree on shape.
2. `HomeFeed.tsx` state per tab:
   ```ts
   const [pages, setPages] = useState<Record<Tab, CardPost[]>>({ foryou, recent, popular, trending });
   const [cursors, setCursors] = useState<Record<Tab, string | null>>(initialCursors);
   const [loading, setLoading] = useState(false);
   ```
   Initial first page + cursor come from `page.tsx` props (server-rendered).
3. Sentinel + observer:
   ```tsx
   const sentinel = useRef<HTMLDivElement>(null);
   useEffect(() => {
     const el = sentinel.current; if (!el) return;
     const io = new IntersectionObserver(([e]) => {
       if (e.isIntersecting && cursors[tab] && !loading) loadMore();
     }, { rootMargin: "800px" }); // prefetch before reaching the end
     io.observe(el); return () => io.disconnect();
   }, [tab, cursors, loading]);
   ```
   `loadMore` calls `loadFeedPageAction(tab, cursors[tab], pages[tab].map(p=>p.id))`,
   appends posts (dedup by id), updates cursor. Show 3 skeleton cards while
   loading; show a `flag`/check "You are all caught up" row when
   `cursors[tab] === null`.
4. Remove per-card staggered `Reveal`/`motion` entrance on infinite pages
   (`HomeFeed.tsx:140-149`) - only animate the FIRST page; appended pages render
   immediately (no pop-in on scroll). Respect `useReducedMotion`.
5. `page.tsx`: stop fetching all 4 feeds eagerly. Fetch only the DEFAULT tab's
   first page server-side (`getFeedPage("foryou", null, 20)`); the other 3 tabs
   lazy-load their first page on first activation (client action) and are then
   cached in `pages` state. This cuts first-paint work ~4x. Keep `force-dynamic`
   but the heavy For-You pipeline now runs once, not 4 pipelines.

### STEP 4 - Filters: make real across all tabs (`FeedFilters.tsx`, `feed.ts`)

1. Pass active prefs into `getFeedPage` so EVERY tab honors them at query time:
   - `only_follows`: filter Popular/Trending/For-You candidate authors to
     `followIds`. (Recent is follows-only already.)
   - `hide_projects`: apply the `project_id` filter (`feed.ts:176`) in ALL tabs,
     not just For-You. Add the same `.filter` to Recent/Popular/Trending result
     mapping or a shared `applyPrefs(posts, prefs)` post-filter.
   - `hide_news`: DECISION REQUIRED (see Open Questions). Two honest options:
     (A) If we INTRODUCE news cards into the main feed stream (interleave
     `news_items` every ~6 posts, X "Today's news" style), then `hide_news`
     gates that interleave - now real. (B) If news stays rail-only, REMOVE the
     `hide_news` chip entirely (delete from `FeedFilters.CHIPS:18-22`,
     `feedback-actions.ts:35,42`, `page.tsx:208`, and the `FeedPrefs` type) and
     replace with a rail-level "Hide daily brief" toggle that actually hides the
     rail card. Do not keep a chip that controls nothing.
   - Recommended: option (A) for a world-class feed - interleave real news from
     `getNewsForUser` into the stream as `variant: "news"` cards (PostCard
     already supports a `news` variant in its type, `PostCard.tsx:93`), gated by
     `hide_news`. This also finally puts the curated news in the place users
     actually look (the stream), not just the rail.
2. Optimistic application: when a chip toggles, do NOT round-trip + reload.
   - Persist via `updateFeedFiltersAction` in the background (keep it) but DROP
     `revalidatePath("/home")` from that action so it does not blow away the
     client feed cache and re-run pipelines.
   - In `HomeFeed`, on pref change, optimistically RE-FILTER the already-loaded
     client `pages` (hide projects/news instantly) and reset the cursor so the
     next `loadMore` fetches with the new prefs. `only_follows` (which changes
     recall, not just a client filter) triggers an immediate
     `loadFeedPageAction(tab, null, [])` refetch of page 1 while showing the old
     list dimmed for <300ms.
   - Lift FeedFilters state up: have `page.tsx` render `FeedFilters` and
     `HomeFeed` under a shared client wrapper, or pass an `onChange` that
     `HomeFeed` consumes (the `onChange` prop already exists,
     `FeedFilters.tsx:15,31`). Wire it.
3. Reduce redundancy: relabel/relocate `only_follows` since "Recent" already is
   follows-only. Options: drop `only_follows` and rely on the Recent tab
   (simplest, less confusing), OR keep it but apply it across all tabs so it is a
   true global "people I follow" lens. Pick one (Open Question).

### STEP 5 - Right rail + scroll fix (`page.tsx`)

1. Align sticky offsets: change rail `sticky top-24` -> `sticky top-20`
   (`page.tsx:239`) so it tucks just under the 64px header with the same rhythm
   as the tab bar (`top-16`). Add `max-h-[calc(100vh-5rem)] overflow-y-auto
   no-scrollbar` to the sticky inner div so a tall rail scrolls independently and
   never traps the page scroll (fixes "scroll feels broken").
2. Desktop visibility: rail already renders from the top on `lg`. Strengthen its
   presence so it does not read as empty/quiet:
   - Ensure the FIRST rail card (Trending tags or People) has real content even
     for new users (People-to-follow uses `getSuggestedConnections`,
     `page.tsx:37` - make sure it returns results via the matching engine; see
     the people-to-follow plan). If a card is empty, do not leave a hole.
   - Promote contrast on rail cards (see Contrast notes) so they read as a real
     second column, not background.
3. Mobile: the slimmed rail currently sits AFTER the entire feed
   (`page.tsx:223-232`) - i.e. only after infinite scroll, which now never ends.
   Fix: move the most useful discovery block (People to follow + a single news
   item) to appear EITHER (a) inline after the first ~5 posts as an injected
   "discovery" card in the stream (LinkedIn/X mobile pattern), or (b) behind a
   compact "Discover" affordance in the tab bar row. Recommended: inject one
   "People to follow" card after post #4 and one "Today's brief" card after post
   #9 on mobile, then drop the trailing rail block entirely. This guarantees
   discovery is visible without scrolling to the (now infinite) end.
4. Remove the dependency on a short feed to see the rail: since the feed is now
   infinite, the rail must be `sticky` and self-scrolling (Step 5.1) so it stays
   in view as the feed grows.

### STEP 6 - Perf / caching

1. Switch eager 4-feed fetch to single-tab fetch (Step 3.5).
2. Stop `revalidatePath("/home")` on every engagement
   (`engagement-actions.ts:15,21,27,37,43,49,55,62,68`) and on filter change
   (`feedback-actions.ts:15,29,45`). Engagement is already optimistic in
   `PostCard` (`PostCard.tsx:146-212`); the revalidate only adds a wasted full
   server re-render of the feed (the founder's ~1s lag). Keep the DB write; drop
   the path revalidation. (Counts will reconcile on next natural load.)
3. Client cache across navigation: the feed is `force-dynamic` so leaving and
   returning re-runs everything. Add a lightweight in-memory client store
   (module-level `Map<Tab, {posts, cursor}>` keyed per session, or a React
   context) so navigating away and back to `/home` restores the loaded pages and
   scroll position instantly (X behavior). Persist scroll offset per tab.
4. Prefetch next page early via `rootMargin: "800px"` on the sentinel (Step 3.3)
   so the next batch is usually loaded before the user reaches it - infinite
   scroll feels seamless, never a spinner at the very bottom.

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

- Tab switch: instant from client cache (`pages[tab]`); never blocks on a
  fetch. Background-load page 1 of an unvisited tab on first activation, show 3
  skeleton cards meanwhile.
- Infinite scroll: prefetch 800px early; skeletons during load; "caught up"
  terminal row. Appended pages render with NO entrance animation (no pop-in).
- Filters: chips flip color instantly (already local state,
  `FeedFilters.tsx:25,28-35`); client list re-filters optimistically for
  hide_projects/hide_news; only_follows does a fast page-1 refetch with the old
  list dimmed briefly. Persist in background, no `revalidatePath`.
- Engagement (like/react/save/repost): already optimistic in PostCard - KEEP,
  and remove the redundant `revalidatePath("/home")` so optimism is not undone
  by a heavy server re-render.
- Scroll: independent self-scrolling sticky rail; aligned sticky offsets; keep
  exactly two sticky layers (header + tab bar). No virtualization needed until
  pages are large (note as future).

## 5. HONESTY + CONTRAST NOTES (fake / blended things to fix)

Fake / dead to make real or remove:
- `hide_news` chip controls nothing (`feedback-actions.ts:35,42`, `page.tsx:208`,
  `FeedFilters.tsx:20`). Either interleave real news into the stream and gate it,
  or delete the chip. No dead controls.
- Trending tab silently mirroring Popular (`feed.ts:305`). Make Trending a true
  velocity feed; remove the silent fallback.
- Static tab count badges (`HomeFeed.tsx:24-29`) imply a true total but are just
  `array.length` capped at 20. Remove or replace with a live "new posts" pill.
- `hide_projects` / `only_follows` only affect For-You - apply across all tabs so
  the control is honest everywhere.

Contrast (no element may blend into its background):
- `text-bone` used as a VISIBLE middot glyph: `page.tsx:172`,
  `PostCard.tsx:407,411`. Replace the glyph color with `text-ash` (or a real
  `bg-bone` dot) so the separator is perceptible.
- `bg-saffron/2` pinned row (`PostCard.tsx:351`) is invisible. Use
  `bg-saffron/8` + a 2px left accent border so "Pinned" is actually visible.
- Inactive tab badge `bg-bone text-ash` (`HomeFeed.tsx:72`) ~3:1 - bump to
  `text-ink/70` if badges are kept.
- Rail cards rely on `card` + quiet `text-ash` labels; ensure label/value
  contrast meets 4.5:1 against `paper` so the rail reads as a real column.

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. News in the feed: do we interleave real `news_items` cards into the main
   stream (making `hide_news` real and putting news where users look), or keep
   news rail-only and DELETE the `hide_news` chip? (Recommend interleave.)
2. `only_follows` chip: keep it as a global "people I follow" lens applied to all
   tabs, or remove it since the Recent tab already is follows-only? (Recommend
   remove to cut redundancy.)
3. Recent tab for new users (0 follows): fall back to a recent-global discovery
   stream with an explanatory header, or keep an explicit empty-state CTA to
   Explore? (Recommend discovery fallback - never a dead tab.)
4. Popular/Trending at scale: are we close to enough posts to justify a
   `posts.hot_score` column refreshed by the nightly job (SQL keyset pagination),
   or is in-window JS ranking fine for now? (Fine for now; revisit past ~10k
   posts.)
5. Tab count badges: drop them, or invest now in the X-style live "N new posts"
   pill? (Recommend drop now, build the live pill in a later pass.)
6. Mobile discovery: inject People/Brief cards inline in the stream (recommended)
   vs a dedicated "Discover" tab/sheet?
