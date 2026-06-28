# 08 - Explore / Discover Page Overhaul

Area owner: the Explore (Discover) page and its data + search.
Scope files: `app/(app)/explore/page.tsx`, `app/(app)/explore/actions.ts`, `components/composite/ExploreSearch.tsx`, `lib/db/social.ts` (`searchAll`, `getSuggestedConnections`), `lib/db/feed.ts` (`getPopularFeed`, `getTrendingFeed`), `lib/db/projects.ts` (`listOpenProjects`/`listProjects`), `lib/ranker/*` (matching engine), the hashtag route `app/(app)/t/[tag]/page.tsx`, and reusable cards `components/composite/PersonCard.tsx`.

This is a PLAN only. No app code is edited here. The only file written is this markdown.

Reference systems for "what good looks like": Twitter/X **Explore** (tabbed: For you / Trending / News / Sports + "Trends for you" with post counts and a short why), Instagram **Search/Explore** (dense visual grid + typeahead with people/tags/places sections), LinkedIn **Search results & "People you may know"** (ranked by mutuals + same school/company, each row carries a reason), Notion-style instant client navigation.

---

## 1. CURRENT STATE (what exists, what is broken / dead / fake)

The page is `app/(app)/explore/page.tsx` (an `async` server component, `force-dynamic`, line 13). It renders, top to bottom:
1. a hero ("Find work, people, and your next project"), lines 64-76;
2. `<ExploreSearch />` (client typeahead), line 79;
3. a 3-column grid with exactly four blocks: one **Featured project**, **Trending now** (hashtags), **People you may know**, **Colleges by members** (lines 89-218).

That is the entire page. It is low-density and several blocks are weak or quietly fake.

### 1a. "Featured project" is `listOpenProjects(1)` - newest, not featured (mislabeled)

`page.tsx:42` calls `listOpenProjects(1)`. `listOpenProjects` (`projects.ts:67-87`) orders `created_at desc` and takes 1 row. So the big hero card labeled **"Featured project"** (`page.tsx:99-101`) is just *the single most recently created open project*. There is no featuring, ranking, or relevance to the viewer. One card for the whole "discover projects" need is far too thin - the real project discovery page `app/(app)/collabs/page.tsx` exists but Explore does not surface a matched, multi-project rail at all.

### 1b. Trending hashtags are recomputed per-request from a 40-post sample - not real trends, and duplicated logic

`page.tsx:41` calls `getPopularFeed(40)`, then lines 50-60 count hashtag occurrences in those 40 posts and take the top 5. Problems:
- It is **whatever 40 "popular" posts** the last-24h query returned (`feed.ts:277-286`), counted by *number of posts containing the tag*, ignoring engagement, velocity, recency-within-window, and the viewer entirely. A tag on 3 low-engagement posts beats a tag on 2 viral ones.
- The exact same block is **duplicated** in `app/(app)/home/page.tsx:61-73` (top 6 from the for-you pool). Two pages compute "trending tags" two different ways from two different pools, so they disagree. There is no single trending source of truth.
- The `hashtags` table (`0001_init.sql:267-271`, columns `tag`, `use_count`, `created_at`) **is never populated**. The only reference to it is the read in `searchAll` (`social.ts:408`). No insert/upsert/trigger writes `use_count` anywhere (grep of `lib` + `supabase/migrations` finds only the SELECT). So the real "tag popularity" table is dead, and trending is reconstructed ad hoc from a tiny post sample instead.
- The materialized views `popular_posts` and `trending_posts` (`0003_views_and_jobs.sql:3-52`, with a real `hot_score` / `spike_score`) exist but Explore never uses them, and their refresh cron is commented out (`0003_views_and_jobs.sql:93-96`).

### 1c. "People you may know" is unranked and uses the brittle exact-college match (shared bug with Network)

`page.tsx:43` calls `getSuggestedConnections(4)`. That function (`social.ts:303-338`) does an **exact-string** `.eq("college", me.college)` with **no `.order(...)`** (lines 319-325), so within a college the four returned people are in arbitrary DB/index order; branch, year, city, interests, and mutual follows are never consulted. On any college-string mismatch it silently falls through to `select(cols)...limit(fetchLimit)` (line 332) = genuinely arbitrary users. The matching engine in `lib/ranker/*` is never imported by `social.ts`. (This is the same root issue documented in `05-people-network.md` 1a; the Explore page inherits it.)

It also renders **no follow/connect action and no "why suggested" reason** - each suggestion is just a plain `<Link>` to the profile (`page.tsx:163-178`). On a *discover* surface you must be able to act (Follow) without leaving the page.

`MiniProfile` (`social.ts:4-11`) carries only `{ id, handle, name, avatar_url, college, branch }` - it cannot rank or explain matches because it lacks `interests`, `year_of_study`, `city`, `verified`.

### 1d. "Colleges by members" pulls 1000 rows to the Node process and counts in JS (real data, wrong place)

`getCollegeLeaderboard` (`page.tsx:15-28`) does `select("college").limit(1000)` then builds a `Map` and sorts in JS. The numbers are real, but: it caps at 1000 profiles (wrong once the network grows past 1000), it ships every college string to the server function on every request, and it is duplicated nowhere else (so it is at least honest, just inefficient and unbounded). It is also only marginally a *discovery* tool - it never links anywhere you can browse those people.

### 1e. Search (`ExploreSearch` + `searchAll`) is functional but thin and not optimistic

- `ExploreSearch.tsx` debounces 300ms (line 24) and calls a server action `searchAction` -> `searchAll` (`actions.ts:5-7`, `social.ts:392-417`). The results render as plain cards (people/posts/projects/hashtags), no keyboard navigation, no recent searches, no avatars/use-counts on hashtags, no relationship state on people (so a person you already follow still shows nothing actionable).
- `searchAll` runs four `textSearch`/`ilike` queries (`social.ts:402-409`). Hashtag search is `.ilike("tag", '%q%')` against the **empty `hashtags` table** (1b), so the **Hashtags section of search is effectively always empty** even when posts with that tag exist. People honor `privacy.searchable` (good, line 405). There is **no ranking** of results - PostgREST default order, not relevance/recency. There is no "no query yet" state that shows trending/suggestions (the whole results region is blank until you type).
- The `isPending` indicator is a tiny "Searching..." in `ash` text top-right (`ExploreSearch.tsx:54-58`); on a slow keystroke the box shows nothing for ~300ms+RTT, which reads as lag.

### 1f. Density / IA problems (the founder's "too empty" complaint, confirmed)

- Whole page is `max-w-6xl` (line 63) but only 4 cards. No tabs, no segmented discovery, no infinite content. After the fold there is nothing - you cannot keep scrolling to discover more posts/people/projects.
- Trending news is **absent** from Explore even though a news system exists (`app/(app)/news/page.tsx`, `lib/news/fetch.ts`). A real Explore (cf. X) has a News column.
- No "suggested projects matched to you", no hashtag-discovery cloud, no trending-people, no per-section "see all" links.

### 1g. Contrast / honesty offenders on this page

- `text-caption` is defined as `color: var(--color-ash)` = `#5A6A86` (`globals.css:144-150`). On `cream` (#F5F7FB) background this is ~4.2:1 - it passes for large/secondary but the all-caps micro-labels ("Discover", "On the radar", "Trending now", "People you may know", "Colleges by members" at `page.tsx:66,84,123,159,191`) are small and sit right at the AA edge. Acceptable but must not get lighter; call out so the redesign keeps these >= 4.5:1.
- Featured-project sub-copy is `text-cream/80` over a cobalt gradient (`page.tsx:103`) - fine, but `line-clamp` hides most of the brief; verify it never renders an empty/near-invisible string.
- Rank "4/5" college number uses `text-ink/40` (`page.tsx:200`) = very low contrast on white; ranks 4-5 are nearly invisible. This is a real low-contrast offender to fix.
- The featured card's gradient is a literal hardcoded hex (`page.tsx:97`, `#0A0F1C -> #1E40D6`) rather than tokens - acceptable visually but should reference `--color-ink`/`--color-saffron-dk` so the brand stays in one place.
- Nothing is fabricated except the *labeling*: "Featured" is not featured (1a) and "Trending" is a 40-post sample (1b). Both must be made real or honestly renamed.

---

## 2. TARGET (world-class + real)

A dense, tabbed, scrollable Explore that mirrors X-Explore / IG-Search / LinkedIn-Search, built entirely on real data and the existing classical ranker (no AI, no mock):

**Header + omni-search (always visible).** One search box with a real typeahead that, *before* you type, shows the discovery content (trending tags, suggested people, suggested projects). As you type it switches to grouped results (People / Projects / Posts / Hashtags) with avatars, hashtag use-counts, relationship state, keyboard nav, and recent searches.

**Segmented tabs under the search** (X-style): **For you** (default) | **Trending** | **People** | **Projects** | **Tags** | **News**. Tabs are client-routed (`?tab=`) so switching is instant and shareable; each tab is its own server-streamed section.

- **For you**: a curated mosaic - a "Suggested people" rail (ranked, with reasons + Follow), a "Projects for you" rail (matched), a "Trending tags" strip, a "Trending news" strip, and a "Popular right now" post grid. This is the high-density landing that fixes "too empty".
- **Trending**: real trends. Top hashtags by a true score (engagement + velocity within window, viewer branch/city boosted), each with post count and a 1-line sample; below them the `getTrendingFeed`/`getPopularFeed` post grid (already real, `feed.ts:277-315`).
- **People**: ranked "people you may know" grid using the SAME feature approach as the feed (same college/branch/city/year + mutual-follow + interest overlap), each card showing the match reason and a real Follow action with optimistic state (reuse `PersonCard`).
- **Projects**: matched open projects (interest/branch overlap with the viewer), with open-slot counts, reusing the real `listProjects` data and the collabs card.
- **Tags**: a hashtag-discovery cloud/grid sized by real `use_count`, linking to `/t/[tag]`.
- **News**: trending news items (most reacted/commented in last 24-48h) linking into `/news/[id]`.

**Reference mapping:** "Trends for you" with counts + reason = X. People rows with "same college / N mutuals" reason = LinkedIn PYMK. Tag/visual grid + instant typeahead sections = Instagram Search. Instant tab switch + client cache = Notion/X SPA feel.

Everything is real: trends come from a real trending source (materialized view or a populated `hashtags.use_count`), people/projects come from the real ranker, news from the real news table. Nothing is labeled "featured/trending" unless it actually is.

---

## 3. STEP-BY-STEP PLAN

Ordered so each step is shippable. New data helpers first, then UI.

### Step 1 - Make hashtag trends REAL (fix 1b, 1e hashtag search)

The `hashtags` table exists but is dead. Two-part fix:

**1.1 Populate `hashtags.use_count` via a DB trigger (new migration).**
Create `supabase/migrations/0027_hashtag_counts.sql`:
- A `before/after insert` trigger on `public.posts` (or extend the existing `tg_post_search_tsv` path) that, for each tag in `NEW.hashtags`, `insert into public.hashtags(tag, use_count) values (lower(tag), 1) on conflict (tag) do update set use_count = public.hashtags.use_count + 1;`. Run it `security definer` (mirroring the counter-trigger pattern in `0012_counter_triggers_security_definer.sql`).
- Add `last_used_at timestamptz` column to `hashtags` and set it to `now()` in the same upsert, so "trending" can favor recent usage.
- Add index `create index on public.hashtags (use_count desc);` and `(last_used_at desc)`.
- Backfill once: `insert into public.hashtags(tag, use_count) select lower(t), count(*) from public.posts, unnest(hashtags) as t group by 1 on conflict ...`.

**1.2 Add `getTrendingHashtags(limit, viewer?)` to a new `lib/db/discover.ts`.**
- Primary source: `select tag, use_count from public.hashtags order by use_count desc, last_used_at desc limit N`. This is the real all-time/recent popularity, replacing the 40-post recount.
- For a *time-windowed* "trending now" variant, compute per-tag recent score from the live pool the same way the feed does: pull last-6h posts (reuse the `getTrendingFeed` recall, `feed.ts:289-315`), aggregate tag -> sum(engagementScore) and tag -> count, sort by recent-engagement (not raw post count). Boost tags matching the viewer's `branch`/`interests` via `expandTags`/`semanticMatch` (`taxonomy.ts:60-97`) so trends are personalized like X "Trends for you".
- Return `{ tag, count, score, sample?: string }`. Use this in BOTH Explore and `home/page.tsx` to kill the duplicate logic (1b).

### Step 2 - Make "People you may know" RANKED + actionable (fix 1c)

This depends on the `05-people-network.md` Step that adds a ranked `getSuggestedConnections`. To avoid duplicating that work:

**2.1 Widen `MiniProfile`** (`social.ts:4-11`) to include `interests: string[] | null`, `year_of_study: string | null`, `city: string | null`, `verified: boolean` (the same author cohort fields the feed already selects, `feed.ts:13`). Update the `cols` strings in `social.ts` to select them.

**2.2 Add a ranked suggester** `getSuggestedPeople(limit, viewer)` in `lib/db/discover.ts` (or reuse the rewritten `getSuggestedConnections` from plan 05). It must:
- Recall a candidate pool (same college OR same branch OR followed-by-people-I-follow / 2nd degree, using the `follows` 2nd-degree pattern from `feed.ts:213-218`), exclude `getExcludedSuggestionIds` (`social.ts:281-301`).
- Score each candidate with a small reuse of `fieldProximity` (`features.ts:17-30`) plus a mutual-follow count and `semanticMatch(viewer.interests, candidate.interests)` (`taxonomy.ts:88-97`). Sort by that score.
- Produce a `reason` string per person ("Same college", "3 mutual connections", "Also into AI/ML", "Same branch"), exactly like the feed produces `reason[]` in `score.ts`.
- Return `Array<MiniProfile & { reason: string; mutualCount: number }>`.

**2.3 Fetch relationship state** for the suggested ids via `getRelationshipStates` (`social.ts:352-390`) so each card renders the correct Follow/Following/Connected/Pending state instead of a blank link.

### Step 3 - Make "Projects for you" REAL + matched (fix 1a)

**3.1 Add `getSuggestedProjects(limit, viewer)` to `lib/db/discover.ts`.** Reuse `listProjects({ filter: "open", limit: 30 })` (`projects.ts:99-140`) as recall, then rank in JS by: project tag/title overlap with the viewer's `interests`/`branch` via `semanticMatch` over the project's hashtags (projects have `search_tsv`, `0001_init.sql:210`; if projects lack a hashtags array, match `title`+`brief` tokens against `expandTagList(interests)`), plus open-slot availability (`member_count` from `projects.ts:82-86`) and recency. Return top N with `open_slots = slot_count - member_count` and a `reason`.
- This replaces the single mislabeled "Featured project" (1a) with a *ranked, matched* multi-project rail, and a genuinely featured top item only if it is the highest-scoring open project (then the "Featured" label is honest).

### Step 4 - Trending news on Explore (fill the missing column, 1f)

**4.1 Add `getTrendingNews(limit)` to `lib/db/discover.ts`** using the existing news data path (`lib/news/fetch.ts` / `lib/db/newsEngage.ts`). Order by recent engagement (reactions+comments in last 24-48h) if those counters exist, else by recency. Render as a compact list linking to `/news/[id]`.

### Step 5 - Rebuild the Explore page shell (fix 1f density + tabs)

**5.1 Rewrite `app/(app)/explore/page.tsx`** as a server component that reads `searchParams.tab` (default `for-you`) and renders:
- A sticky header: title + `<ExploreSearch />` (kept, upgraded in Step 6).
- A client `<ExploreTabs current={tab} />` (new `components/composite/ExploreTabs.tsx`) that updates `?tab=` via `router.push(..., { scroll: false })` for instant, shareable switching.
- The section for the active tab. Fetch the right data per tab with `Promise.all`:
  - `for-you`: `Promise.all([getSuggestedPeople(6), getSuggestedProjects(4), getTrendingHashtags(8), getTrendingNews(5), getPopularFeed(12)])`.
  - `trending`: `getTrendingHashtags(20)` + `getTrendingFeed(18)`.
  - `people`: `getSuggestedPeople(24)` + `getRelationshipStates`.
  - `projects`: `getSuggestedProjects(18)`.
  - `tags`: `getTrendingHashtags(60)` (cloud).
  - `news`: `getTrendingNews(20)`.
- Wrap each section in `<Suspense>` with skeletons so tabs stream and never block on the slowest query.

**5.2 New section components** (`components/composite/explore/`):
- `SuggestedPeopleRail.tsx` - horizontal scroll of `PersonCard variant="grid"` (reuse `components/composite/PersonCard.tsx`) with the new `reason` line under name/handle; "See all" -> `?tab=people`.
- `SuggestedProjectsRail.tsx` - reuse the collabs card layout; show `open_slots`, brief, author, reason.
- `TrendingTagsStrip.tsx` - numbered list like current trending (keep the editorial numerals `page.tsx:133-135`) but driven by real counts from Step 1; each links `/t/[tag]`.
- `TrendingNewsStrip.tsx` - compact news list.
- `PopularPostsGrid.tsx` - reuse `PostCard` / `toCardPost` (`lib/ui/toCardPost.ts`) to render real popular posts so the page is infinitely scrollable.
- `TagCloud.tsx` - sized chips by `use_count` for the Tags tab.

**5.3 Replace the college leaderboard query** (`page.tsx:15-28`): move it into `getCollegeLeaderboard` in `lib/db/discover.ts` and compute with a SQL aggregate (`select college, count(*) ... group by college order by 2 desc limit N`) via an RPC or a `.rpc`, instead of pulling 1000 rows to JS (fix 1d). Keep it on the For-you tab as a small "Top campuses" card, each row linking to a college-filtered people view (or search).

### Step 6 - Upgrade `ExploreSearch` to world-class typeahead (fix 1e)

**6.1 Pre-query state.** When `query` is empty, instead of `setResults(null)` and a blank region (`ExploreSearch.tsx:20-23`), show: "Recent searches" (localStorage) + "Trending tags" + a few "Suggested people". This is the IG/X empty-search behavior.

**6.2 Real-time optimism + ranking.** Keep the 300ms debounce but: show an immediate skeleton list on keystroke (not just a tiny "Searching..." label), and have `searchAll` return results ordered by relevance/recency. For people, also fetch `getRelationshipStates` for the result ids and render a Follow button with optimistic state directly in the dropdown (reuse the PersonCard follow handler pattern). For hashtags, show `use_count` (now real after Step 1) so the empty-hashtag-section bug (1e) is gone.

**6.3 Keyboard nav + a11y.** Arrow-up/down through grouped results, Enter to navigate, Esc to clear; `role="listbox"`/`option` and `aria-activedescendant`. Each result is a real `<Link>` so it also works without JS.

**6.4 `searchAll` ranking** (`social.ts:392-417`): add `.order(...)` by recency/engagement where columns allow, and (optional) rank people results by `fieldProximity` to the viewer so a search for "Aman" surfaces the Aman at your college first (LinkedIn behavior). Hashtag query stays `ilike` but now hits a populated table.

### Step 7 - Cross-page dedup + cleanup

- Delete the inline trending-hashtag recompute in `app/(app)/home/page.tsx:61-73` and call `getTrendingHashtags` so Home and Explore agree.
- Remove the local `getCollegeLeaderboard`/trending logic from `explore/page.tsx` (now in `discover.ts`).
- Ensure `t/[tag]/page.tsx` still works (it queries `posts` by `contains(hashtags)`, `t/[tag]/page.tsx:25-32`, independent of the `hashtags` table, so no change needed - but it should also show `use_count` and "related tags" via `expandTags` for richer discovery).

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

- **Instant tab switch:** `ExploreTabs` updates `?tab=` with `router.push(url, { scroll: false })` and Next App Router caches each segment, so re-visiting a tab is instant (Notion/X feel). Prefetch the People/Projects tabs on hover of the tab control.
- **Streaming, never block:** each tab section is wrapped in `<Suspense>` with a skeleton that matches the final card geometry, so the header + search paint immediately and the slowest query (popular posts) never delays first paint. This directly attacks the ~1s perceived lag.
- **Optimistic Follow everywhere on Explore:** every `PersonCard` Follow (in rails, People tab, and search dropdown) flips to "Following" instantly via local state (the existing pattern in `PersonCard.tsx:33-47`); the server action must NOT `revalidatePath("/explore")` (that refetches the whole tree - the lag source called out in plan 05 1e). Instead it returns `{ ok }` and the optimistic state stands; reconcile only on next natural navigation.
- **Search responsiveness:** show a skeleton dropdown on the first keystroke (before debounce resolves) so typing feels live; cache the last few query->results in a client `Map` so backspacing to a prior query is instant.
- **Replace 1000-row JS counts** (1d) with SQL aggregates so the For-you tab's heavy query is bounded and fast as the network grows.
- **Reuse materialized views** `trending_posts`/`popular_posts` (`0003_views_and_jobs.sql`) for the post grids and enable their refresh cron (uncomment `0003:93-96`) so the grids are pre-ranked in the DB rather than sorted in Node on every request (`feed.ts:285`).

## 5. HONESTY + CONTRAST NOTES

- **"Featured project" -> honest:** either rank a real top project (then it is genuinely featured) or rename to "Latest project". Current label is fake (1a).
- **"Trending now" -> real:** trends must come from the populated `hashtags.use_count` + windowed engagement score (Step 1), not a 40-post recount (1b).
- **Hashtag search no longer silently empty:** after Step 1 the `hashtags` table has rows, so the Hashtags section of search returns results (was always empty, 1e).
- **Fix low-contrast ranks:** the `text-ink/40` college ranks 4-5 (`page.tsx:200`) are near-invisible on white - use at least `text-ash` (#5A6A86) or `text-ink/70`; never below 4.5:1 for any text. Audit every new chip/label: trending numerals, "reason" lines, use-count chips, and tab labels must all clear 4.5:1 on `cream`/`paper`.
- **Tokens, not hex:** replace the hardcoded gradient hex (`page.tsx:97`) with `--color-ink`/`--color-saffron-dk`.
- **No fabricated content:** every count (tag posts, mutuals, open slots, college members) is computed from real rows; if a section has no data, show an honest empty state (as the current page already does at `page.tsx:110-115,150,182,214`) rather than placeholder/sample data. No Hindi-only strings, no em dashes.

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. **Trending window:** should "Trending" mean all-time popular tags (`use_count`) or last-N-hours velocity (X-style)? Recommendation: a personalized last-24h windowed score with `use_count` as tiebreaker. Confirm window (6h vs 24h).
2. **Default tab:** land Explore on **For you** (curated mosaic) or **Trending**? Recommendation: For you.
3. **Projects in Explore vs `/collabs`:** is `/collabs` (`app/(app)/collabs/page.tsx`) staying the primary project-discovery surface? If so, the Explore "Projects" tab should be a *teaser rail* that deep-links to `/collabs` rather than a full duplicate. Confirm.
4. **College leaderboard placement:** keep "Top campuses" on Explore at all, and should each row link to a college-filtered people list (needs a `/people?college=` or search route that does not exist yet)?
5. **Logged-out Explore:** should Explore be public (SEO/discovery) with generic trending + no personalization, or auth-only? `searchAll`/`getSuggestedConnections` already degrade for `!user`, so public is feasible.
6. **News on Explore:** is news engagement (reactions/comments) counted in a way we can rank by, or should trending-news fall back to recency for now?
