# 09 - News (real news, real summaries, field-matched)

Area owner doc. Make Collab47 News read like a real news product (Apple News / Google News / InShorts / Flipboard "For You"), not like a social post wrapped around a raw article URL. Every item must have a real AI summary, look like news (not a "post" with an ID and "post points"), drop the engineering-branch tag chips, keep the working items, fix the broken ones, and be field-matched to the user with the SAME classical engine the feed uses (`lib/ranker/*` + the recall/score pattern in `lib/db/feed.ts`).

Reference products:
- **Apple News / Google News "For You"**: source name + masthead, headline, 2-3 line standfirst (summary), timestamp, large image, "topics" that are real reader-facing categories (Tech, Business, Careers) - never internal taxonomy codes like "CSE".
- **InShorts**: the 60-word card-reader loop (already the shape of `InShortsFeed`), but with a real summary on EVERY card and a clean source/time chrome, not an index number badge.
- **Flipboard "For You"**: personalised by declared topics + reading behaviour.

---

## 1. CURRENT STATE (what exists, what is broken / dead / fake)

### 1a. The reader page literally calls news items "stories" but shows post chrome - and the card shows a fake "index number" badge

`components/composite/InShortsFeed.tsx` is the `/news` reader. It is mostly good (snap-scroll loop, sticky action bar), but it ships several "this is a social post, not news" tells:

- **Fake serial-number badge.** Each card prints `String(idx + 1).padStart(2, "0")` as a chrome badge - top-right over the image (`InShortsFeed.tsx:124-126`) and again on the no-image gradient (`:131-133`). This looks like a post ID / "item #07" and reads as a database artefact, not news. Real news products never number the n-th card in your infinite feed. **Remove.**
- **Branch tag chips on every card** (`InShortsFeed.tsx:146-154`) render the internal taxonomy (`CSE`, `Mechanical`, `Design`) as saffron pills. These are internal routing labels, not reader-facing categories. The prompt requires removing them. **Remove from the card.**
- **"Open to read the full story." fallback** (`InShortsFeed.tsx:143`) appears whenever `excerpt` is null - i.e. whenever the article never got a summary. That is the visible symptom of 1d below (missing summaries). This is the "raw article URL + nothing" failure mode.
- Two raw `<img>` with `object-contain` on an `bg-ink` box (`:118-127`) - fine functionally, but `object-contain` + dark letterboxing on a portrait feed looks like a broken/placeholdered post, not an edge-to-edge news hero. Real news cards use `object-cover` with a fixed aspect ratio.

### 1b. The detail page is built like a post detail, not an article

`app/(app)/news/[id]/page.tsx`:
- Renders **branch tag chips** at `:84-92` (saffron pills) - same internal-taxonomy leak, must go.
- The whole "engagement" block is **post-shaped**: like/dislike/comment/share/report counts (`NewsActions` at `:96-102`) sitting under the article exactly like a feed post's action bar. News should support light reactions and discussion, but the current treatment (thumbs-up COUNT + thumbs-down COUNT shown prominently, "report" flag inline) makes a Reuters headline look like a Reddit submission. This is the "post points/comments shown like a social post" complaint.
- `readMinutes(item.excerpt)` (`:73`) computes read-time from the **summary length**, not the article length. A 130-word summary always yields "1 min read" - a slightly fake stat. Either compute from real content or drop it.
- The summary itself is rendered as the article body (`:78-82`) with a `whitespace-pre-line` block; when `excerpt` is null it shows "Summary unavailable for this story." (`:81`) - again the missing-summary symptom.

### 1c. `NewsActions` is the social post action bar, reused verbatim - including a wrong `targetType`

`components/composite/NewsActions.tsx`:
- It is a thumbs-up/thumbs-down/comment/share/report row identical in spirit to a post's. The "post points"-style **counts next to like/dislike** are at `:121` and `:137`. For news, prominent up/down VOTE COUNTS on a third-party headline are the single biggest "this is a social post" tell. (You are not voting Reuters up or down; you are saving / discussing / sharing it.)
- **Real bug:** the report modal is opened with `targetType="post"` (`NewsActions.tsx:186`) for a NEWS item. The DB supports `reports.news_id` (migration `0023_reports_news_target.sql`, and `reportNews` writes `news_id`), but the modal advertises the wrong target type to the user and any downstream typed handling. Low-grade but it is genuinely wrong.
- Share copies `/news/{id}` to clipboard with a "Copied!" toast (`:57-82`) - this part is real and good; keep it.

### 1d. Summaries are NOT guaranteed on every item - the core "trash" problem

The summary pipeline is real (Groq is wired), but **coverage is partial by design**, so many items have no real summary:

- `lib/news/fetch.ts:21` - `SUMMARISE_LIMIT = 60`. Only the newest 60 fresh articles per run go through Groq. The rest fall back to `trimWords(content,160)` or the raw `excerpt`, and items from sources that ship **title-only feeds carry no body at all**, so their summary is `null`.
- `lib/news/fetch.ts:155-158` - summary priority is `Groq > trimmed content > raw description > null`. The `null` tail is exactly what produces "Open to read the full story." cards (1a) and "Summary unavailable" detail pages (1b). Those are the broken/"trash" items: a headline + a link + nothing.
- GDELT articles are parsed with `excerpt: ""` and no `content` (`lib/news/parser.ts:158-160`), so a GDELT item that misses the top-60 summary window has **literally no text** beyond the title. These are the worst offenders.
- The summary is stored in the **`excerpt` column** (there is no dedicated `summary` column - `news_items` schema, `0001_init.sql:252-263` + `0014_news_engagement.sql`). So we cannot tell "this is an editor summary" from "this is a raw RSS blurb" - they share a field. That ambiguity is why the UI can't promise a real summary.

Net: summaries exist for some items, are absent for a meaningful tail, and there is no column-level honesty about which is which.

### 1e. The `/news` page does NO server-side personalisation; matching is a separate localStorage toy, disconnected from the real engine

- `app/(app)/news/page.tsx:13` calls `getNewsForUser(undefined, undefined, 500)` - **no branch, no city** - so the server returns the 500 most-recent items globally, ordered purely by `published_at` (`lib/news/fetch.ts:190-194`). There is zero server-side field matching.
- All "personalisation" is `lib/newsPersonalize.ts` - a **client-only localStorage** profile: tokenise the title, +2 weight on "More like this", `rankShuffle` by `score + Math.random()`. It does not read the user's declared `branch` / `interests`, does not use the taxonomy graph (`lib/ranker/taxonomy.ts`), does not use reading behaviour, and resets per browser. It is a self-contained toy that **ignores the real classical engine** the prompt wants extended.
- The "More like this" heart (`InShortsFeed.tsx:182-195`) writes ONLY to localStorage (`onInterested` -> `reinforce` -> `saveProfile`). It never touches the DB, so it cannot inform server ranking, cross-device, or the rest of the app. It is real (it does change the next local cycle) but isolated.
- The empty-state copy is honest-ish but wrong about scope: "pulling career stories **for your branch**" (`InShortsFeed.tsx:97-98`) - the server didn't filter by branch at all, so this claim is currently false.

### 1f. Dead code: `NewsRail` is never rendered

`components/composite/NewsRail.tsx` is a complete, well-built right-rail news widget (`getNewsForUser(branch, city, 6)`), but a repo-wide search finds **no import / no JSX usage** anywhere (`grep -rn 'NewsRail'` -> only the file itself). It is dead. Either wire it into the home right rail (where it would be genuinely useful and where it WOULD pass branch/city) or delete it. Right now it is unused weight.

### 1g. The branch tagger is keyword-mechanical and leaks internal codes (the thing to remove)

`lib/news/tagger.ts` matches title + first 200 chars against per-branch keyword lists and emits `branch_tags` like `["CSE","MBA"]`. The prompt explicitly says: **remove the branch tags** (mechanical/CSE/design assignment) from the UI. The keyword match is also crude (substring `"AI"` matches "rAInfall", `"data"` matches "candidate", `"app"` matches "happen"), so the tags are often wrong as well as ugly. We keep tagging internally for MATCHING (mapped to real topics), but it must never render as a chip, and it should not be the basis of relevance.

### 1h. Source/quality gaps that make items look broken

- `NEWS_SOURCES` includes **Hacker News** and a **GDELT "india students"** query whose items are frequently low-quality, image-less, summary-less, and off-topic for a careers/campus product. They are a big share of the "trash" cards.
- No image fallback strategy beyond the cobalt gradient block - fine, but combined with `object-contain` it reads as broken.
- No dedupe by TITLE (only by URL, `fetch.ts:130-135`), so the same wire story from three sources shows three times.

---

## 2. TARGET (world-class + real)

A two-surface news product:

**A. `/news` - the immersive card reader (keep the InShorts loop, upgrade the chrome + matching).**
Each card looks like an Apple-News/InShorts card:
- Edge-to-edge `object-cover` hero (fixed 16:9 / portrait crop), source masthead chip bottom-left, a single **real reader-facing topic** chip (Tech / Business / Careers / Science) - NOT "CSE".
- Big serif headline, a **guaranteed** 40-60 word summary (every card, no exceptions, no "open to read").
- Source + timestamp line. No index number. No branch pills.
- Bottom bar: **Save** (bookmark), **Discuss** (comment count, secondary), **Share**, **Open original**, and a subtle **"More like this" / "Less like this"** pair that feeds BOTH the local loop AND a durable signal. No prominent up/down vote counts on a third-party headline.

**B. `/news/[id]` - a clean reader / article page.**
- Hero image (cover), source masthead, timestamp, real read-time (from real length or omitted), serif headline, the AI summary as a clearly-labelled "The brief" block, then a prominent "Read full story on {source}" CTA.
- Reactions become **Save + a single subtle "useful" toggle** (no public up/down counts), a Share, and a Report in an overflow menu (not inline). Comments stay (campus discussion is a real feature) but are visually a discussion section, not post "points".
- Reader-facing **topic** chips (mapped from internal tags), linking to a topic filter, like Google News topic pages.

**C. Matching = the real classical engine, extended to news.**
- Server ranks `/news` by the same shape as `lib/db/feed.ts`: recall recent items, then SCORE each with features = `{ semanticMatch(interests, item-topics), branchMatch, recency, sourceTrust, readingBehaviourAffinity, popularity }`, using `lib/ranker/taxonomy.ts` to expand interests to related topics (so an "AI/ML" student matches a "GPU"/"LLM" story even if it's tagged generically). Same philosophy as feed/trending/people, per the prompt.
- The localStorage loop stays as an instant, no-DB personalisation layer ON TOP, but it is seeded FROM the server's match (not from scratch) and its "More like this" also persists a durable per-user topic-affinity signal so it informs server ranking next visit and is consistent across devices.

**D. Every item has a real summary, guaranteed.**
- A dedicated `summary` column + `summary_status` so the UI can promise "real brief on every card". The fetch job summarises ALL fresh items with text; items with no usable text are either summarised from the headline (Groq can expand a headline into 3-4 factual sentences - the system prompt already does this, `summarise.ts:25`) or dropped if they have neither image nor text. A backfill job fills summaries for the existing null tail.

---

## 3. STEP-BY-STEP PLAN (ordered, concrete)

### Step 1 - DB: a real summary column, a reader-facing topic, and a durable per-user news affinity

Create migration `supabase/migrations/0027_news_quality.sql`:

```sql
-- 1. Honest summary fields on news_items (distinct from raw excerpt)
alter table public.news_items
  add column if not exists summary        text,
  add column if not exists summary_status text not null default 'none'
    check (summary_status in ('ai','headline','raw','none')),
  add column if not exists topics         text[] not null default '{}', -- reader-facing: Tech/Business/Careers/...
  add column if not exists lang           text not null default 'en';

-- Backfill: treat existing excerpt as the summary (status 'raw') so nothing regresses.
update public.news_items
  set summary = excerpt, summary_status = case when excerpt is null then 'none' else 'raw' end
  where summary is null;

create index if not exists news_items_topics_gin on public.news_items using gin (topics);

-- 2. Durable, per-user news topic affinity (the bridge from the localStorage toy
--    to the real cross-device engine). One row per (user, topic).
create table if not exists public.news_topic_affinity (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  topic      text not null,
  weight     real not null default 0,          -- decayed reinforcement
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);
alter table public.news_topic_affinity enable row level security;
create policy "nta_read_own"   on public.news_topic_affinity for select using (auth.uid() = user_id);
create policy "nta_upsert_own" on public.news_topic_affinity for insert with check (auth.uid() = user_id);
create policy "nta_update_own" on public.news_topic_affinity for update using (auth.uid() = user_id);

-- 3. Optional: lightweight reading-behaviour log for news (mirrors feed_events).
create table if not exists public.news_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  news_id    uuid not null references public.news_items(id) on delete cascade,
  kind       text not null check (kind in ('impression','open','save','more','less','share')),
  created_at timestamptz not null default now()
);
alter table public.news_events enable row level security;
create policy "news_events_insert_own" on public.news_events for insert with check (auth.uid() = user_id);
create policy "news_events_read_own"   on public.news_events for select using (auth.uid() = user_id);
create index if not exists news_events_user_created on public.news_events (user_id, created_at desc);
```

Add the new columns to the type: `lib/supabase/types.ts` `NewsItem` -> add `summary: string | null; summary_status: 'ai'|'headline'|'raw'|'none'; topics: string[]; lang: string`.

### Step 2 - Topic mapping: internal branch tags -> reader-facing topics (kill the "CSE" leak)

Create `lib/news/topics.ts`:
- `export const TOPICS = ["Tech","Business","Careers","Science","Design","Engineering","Policy","Campus"] as const;`
- `branchToTopics(branch_tags: string[]): string[]` - map internal codes to reader topics: `CSE/ECE/Electrical -> Tech` (+ `Engineering`), `MBA/BBA -> Business`, `Mechanical/Civil -> Engineering`, `Design -> Design`, `Biotech -> Science`. Plus a few keyword rules for `Careers`/`Campus` (placement, internship, hiring, exam, admission, scholarship).
- This is what renders as a chip; `branch_tags` stays internal-only (used by the matcher, never shown).

In `lib/news/fetch.ts` step 5 (`rows = fresh.map(...)`), compute `topics: branchToTopics(tags.branch_tags, a.title, summary)` and store it. Keep writing `branch_tags` for the matcher.

### Step 3 - Guarantee a real summary on EVERY stored item

In `lib/news/fetch.ts`:
1. **Drop summary-less, image-less, text-less items before insert.** After building `fresh`, filter out any article with no `image_url` AND no `content` AND a `title` shorter than ~8 words (these are the GDELT/HN "trash" rows). This removes the worst broken cards at the source.
2. **Summarise everything with usable text, not just 60.** Raise `SUMMARISE_LIMIT` to cover all fresh items that have `content || excerpt` (keep concurrency at 6; the 8b-instant model is fast and free per `summarise.ts:13`). For items with thin text, the existing system prompt already instructs Groq to "expand sensibly from the headline into 3 to 4 factual sentences" (`summarise.ts:25`) - rely on it for headline-only items.
3. **Set `summary` + `summary_status` honestly.** `summary = groqSummary` -> status `ai`; else if Groq expanded from headline -> `headline`; else trimmed content -> `raw`; if still nothing -> **do not insert** the row. Keep `excerpt` as the raw publisher blurb for provenance, but the UI reads `summary`.
4. **Tighten the summary prompt for the card format.** The current prompt asks for 130-160 words (`summarise.ts:21`) which is good for the detail page but too long for the InShorts card. Return a single summary but have the UI clamp to ~3 lines on the card and show full on detail; OR add a second short field. Simplest: keep one 90-110 word summary, `line-clamp-4` on the card, full on detail.
5. **Title-dedupe.** In the dedupe map (`fetch.ts:130-135`) add a normalised-title key (lowercase, strip punctuation, first 10 words) so the same wire story from 3 sources collapses to one.

Create `supabase/migrations` is not needed for this step (Step 1 added the columns).

Create a one-off backfill: `app/api/cron/news-backfill/route.ts` (cron-secret protected, mirrors `app/api/cron/news/route.ts`) that selects `news_items where summary_status in ('raw','none')`, runs `summariseArticle` over `title + excerpt`, and updates `summary`/`summary_status`. Run once, then it idles.

### Step 4 - Trim/curate sources so fewer broken items arrive

In `lib/news/sources.ts`:
- Remove the `GDELT "india students"` source (lowest quality, no body, no image) - or replace its query with a curated careers/tech query AND require it to pass the Step 3 drop filter.
- Keep Hacker News only if mapped to topic `Tech` and only when it has a real summary (it has body via the linked article? No - hnrss ships title+comments link; treat HN items as headline-only -> Groq-expanded, and only keep if expansion succeeds).
- Keep The Hindu, LiveMint, MoneyControl, and all keyed APIs (Guardian/NewsData/GNews/NYT/etc.) which carry real body text (`lib/news/apiSources.ts`).

### Step 5 - Server-side matching with the real classical engine

Create `lib/news/rank.ts` (the news analogue of `lib/db/feed.ts`'s scorer), reusing `lib/ranker/taxonomy.ts`:

```ts
// Inputs: items: NewsItem[], viewer { interests, branch, city }, affinity Map<topic,number>, behaviourTopics Map<topic,number>
// For each item:
//   semantic   = semanticMatch(viewer.interests, item.topics ++ item.branch_tags)   // taxonomy-expanded
//   branchMatch= viewer.branch && item.branch_tags includes branch ? 1 : 0
//   recency    = exp(-ageHours/24)
//   affinity   = max over item.topics of affinity.get(topic)         // durable per-user, from news_topic_affinity
//   behaviour  = max over item.topics of behaviourTopics.get(topic)  // from news_events opens/saves
//   sourceTrust= curated map (The Hindu/Guardian/NYT high, GDELT low)
//   popularity = clamp01((like_count + 2*comment_count) / (… + 10))
// score = 0.34*semantic + 0.30*recency + 0.14*affinity + 0.10*behaviour + 0.06*branchMatch + 0.04*sourceTrust + 0.02*popularity
// then a small diversity pass (don't show 5 cards of the same topic in a row).
```

Update `getNewsForUser` (or add `getRankedNewsForUser`) in `lib/news/fetch.ts`:
- Load the viewer's `interests, branch, city` from `profiles` (same query shape as `feed.ts:65`).
- Load `news_topic_affinity` for the user into a `Map<topic, weight>`.
- Recall the most recent ~300 items (not 500), score them with `lib/news/rank.ts`, diversify, return top N.
- `app/(app)/news/page.tsx:13` calls the ranked version; the localStorage loop then re-shuffles within that already-matched, already-relevant set (so the client toy now sits on top of real relevance, not random recency).

### Step 6 - Persist "More like this / Less like this" to a durable signal (server action)

Create `app/(app)/news/actions.ts -> setNewsTopicSignal(newsId, dir: 'more'|'less')`:
- Server action: look up the item's `topics`, upsert `news_topic_affinity` (`weight += dir==='more' ? +1 : -0.5`, clamped), and insert a `news_events` row (`kind: 'more'|'less'`). Fire-and-forget; the client still updates localStorage instantly for the current session (optimistic).
- `InShortsFeed.onInterested` (`InShortsFeed.tsx:77-86`) calls this in a `startTransition` AFTER updating local state, so the screen never waits on the network.

### Step 7 - Rebuild the card chrome (`InShortsFeed.tsx`) to look like news

- **Remove** the index-number badges (`InShortsFeed.tsx:124-126` and `:131-133`).
- **Remove** the branch_tags chips block (`:146-154`). Replace with a single reader-facing topic chip drawn from `item.topics[0]` (Tech/Business/Careers), placed in the source line, styled as a subtle uppercase label - high contrast (`text-ink` on `bg-bone`, NOT saffron-on-saffron/10).
- Image: `object-cover` with `aspect-[16/9]` (or `aspect-[4/5]` for the portrait reader) instead of `object-contain` on `bg-ink` letterboxing. Keep the source masthead chip bottom-left (`bg-ink/80 text-cream` - already high contrast, keep).
- Summary: render `item.summary` with `line-clamp-4`; since Step 3 guarantees a summary, **delete the "Open to read the full story." fallback** (`:143`).
- Replace the inline up/down counts with the new bottom bar (Step 8).

### Step 8 - Replace `NewsActions` social-post bar with a news action bar

Refactor `components/composite/NewsActions.tsx` (or create `NewsArticleActions.tsx`) to:
- **Save** (bookmark) toggle - the primary action, optimistic, persists to a `news_saves` table (add to Step 1 migration if we want real saves; small table `news_saves(user_id, news_id, created_at)` with RLS). This replaces "like" as the meaningful keep signal.
- **Discuss** - links to `/news/{id}#comments`, shows `comment_count` (real, trigger-maintained) but subtly, not as a "points" number.
- **Share** - keep exactly as-is (`NewsActions.tsx:57-82`); it works and gives feedback.
- **Overflow (⋯)** -> Report. Fix the `targetType="post"` bug: pass `targetType="news"` (and ensure `ReportModal` + `reportNews` accept it - `reportNews` already writes `news_id`).
- **Remove** the prominent thumbs-up/thumbs-down COUNTS on third-party headlines (`:108-138`). Keep an optional subtle "More/Less like this" pair wired to Step 6, but with NO public count.

Detail page `app/(app)/news/[id]/page.tsx`:
- Remove branch chips (`:84-92`); render `item.topics` chips instead, high-contrast.
- Label the summary block "The brief" and render `item.summary` (guaranteed).
- Read-time: compute from real source length if we store it, else **omit** rather than fake it from the summary (`:73`).
- Move Report into the overflow; keep Save + Share + the "Read full story" CTA prominent.

### Step 9 - Wire or remove `NewsRail`

Decision: **wire it into the home right rail** (it already takes `branch`/`city` and links to `/news/{id}`, and uses `getNewsForUser(branch, city, 6)`). Import it in `app/(app)/home/page.tsx`'s right rail passing the viewer's `branch`/`city`. Update its copy from "Career news for your branch" to honest "Top stories for you" (since it now uses the ranked source). If the founder prefers a single news surface, **delete `NewsRail.tsx`** instead - do not leave it dead.

### Step 10 - Honest empty/loading states + copy

- `InShortsFeed.tsx:97-98` empty copy: change "pulling career stories for your branch" to "The news engine runs hourly. New stories will appear here." (the server now DOES rank by field, so we can keep a softer "matched to your interests" line, but only after Step 5 ships).
- Add a lightweight skeleton for `/news` first paint (3 shimmer cards) so navigation feels instant.

---

## 4. OPTIMISTIC-UI / PERF NOTES

The founder reports ~1s lag to register actions. For news:

- **Save / More-like-this / Less-like-this**: update local state and the localStorage profile SYNCHRONOUSLY on click (already the pattern in `InShortsFeed.onInterested`), then fire the server action inside `useTransition` (Step 6). The DB write (`news_topic_affinity` upsert + `news_events` insert) is fire-and-forget; the user NEVER waits. This is already correctly avoided-revalidate per the comment in `actions.ts:16-21` - keep that discipline (do NOT `revalidatePath('/news')` on reaction; it would remount the loop).
- **Reactions on the detail page**: `NewsActions` already applies optimistic counts (`NewsActions.tsx:34-50`) - keep that mechanism for Save/comment-count; it is correct.
- **Comments**: currently `addNewsCommentAction` does `revalidatePath('/news/{id}')` (`actions.ts:31`) which round-trips and re-renders the whole thread. Make the comment composer optimistic: prepend the new comment to a client list immediately, then submit; reconcile on success. Move the thread to a small client component so a new comment appears instantly (LinkedIn/Instagram comment behaviour).
- **Navigation**: `/news/[id]` is `force-dynamic` and re-fetches item + reaction + comments on every open. Card -> detail should feel instant: pass the already-loaded `NewsItem` via client navigation/router state or render the summary from the card's data immediately (it's already in memory in `InShortsFeed`), then hydrate reactions/comments. Add `prefetch` on the "Read in app" `Link`.
- **Card images**: `loading="lazy"` is already set; add `decoding="async"` and a fixed aspect box so images don't cause layout shift as you snap-scroll.
- **Server cost**: lower the `/news` recall from 500 to ~300 ranked items; the loop is infinite via client cycles anyway (`InShortsFeed.makeCycle`), so 300 matched items is plenty and halves the initial payload.

## 5. HONESTY + CONTRAST NOTES

Fake / dead / blended things to fix:

- **Fake serial-number badge** on every card (`InShortsFeed.tsx:124-126`, `:131-133`) - looks like a post ID. Remove.
- **Internal taxonomy leaking as UI** - `branch_tags` chips on card (`InShortsFeed.tsx:146-154`) and detail (`[id]/page.tsx:84-92`). Remove; replace with reader-facing `topics`.
- **Missing-summary "trash" items** - "Open to read the full story." (`InShortsFeed.tsx:143`) and "Summary unavailable for this story." (`[id]/page.tsx:81`) are the visible symptom of partial summarisation. Fixed by Step 3 (guarantee a summary or drop the item).
- **Fake read-time** - `readMinutes(item.excerpt)` (`[id]/page.tsx:73`) computes minutes from the summary, not the article. Compute from real length or omit.
- **Wrong report target** - `targetType="post"` for a news item (`NewsActions.tsx:186`). Fix to `news`.
- **False empty-state claim** - "for your branch" (`InShortsFeed.tsx:97-98`) while the server passes no branch. Fix copy now; the claim becomes TRUE after Step 5.
- **Disconnected personalisation** - `lib/newsPersonalize.ts` is a localStorage toy ignoring the real engine and the user's declared field. Step 5/6 connect it to `lib/ranker/taxonomy.ts` + `news_topic_affinity`.
- **Contrast**: branch chips currently use `text-saffron-dk` / `text-saffron` on `bg-saffron/10` (`InShortsFeed.tsx:149`, `[id]/page.tsx:87`) - cobalt-on-pale-cobalt is low contrast. The replacement topic chip must be `text-ink` on `bg-bone` (or `text-cream` on `bg-ink`) - high contrast. The "Swipe up for next" hint is `text-ash` (`InShortsFeed.tsx:224`) on `bg-cream` - borderline; bump to `text-ink/70` or add a subtle backdrop. The no-image gradient block text `text-cream/90` on the cobalt gradient (`:130`) is fine. Verify the `bg-cream/95` action bar text stays `text-ink`/`text-ash` (it does).
- **Dead code** - `NewsRail.tsx` unused (Step 9: wire or delete). `lib/newsPersonalize.STOP` list and `rankShuffle` stay but become a layer on top of real ranking, not the only ranking.
- Source honesty: keep real publisher names (The Hindu, LiveMint, Guardian, NYT). No invented sources. Location stays "India" where unknown.

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. **News identity**: should news support up/down VOTES at all, or only Save + Discuss + Share? My recommendation is to drop public up/down counts on third-party headlines (they make it look like Reddit) and keep Save/Discuss/Share. Confirm.
2. **Reader-facing topics**: is the set `Tech / Business / Careers / Science / Design / Engineering / Policy / Campus` the right vocabulary for a campus careers product, or do you want a different/shorter set?
3. **Source curation**: OK to drop the GDELT "india students" source and treat Hacker News as headline-only (Groq-expanded, kept only if expansion succeeds)? These are the biggest "trash" contributors.
4. **Summarise-all cost**: removing the 60-item cap means more Groq calls per run. The model is free (`llama-3.1-8b-instant`) but rate-limited. Acceptable to raise the cap and rely on bounded concurrency, or keep a cap (e.g. 150) and run a separate backfill for the tail?
5. **`NewsRail`**: wire it into the home right rail, or delete it? (I lean: wire it, it's genuinely useful and already field-aware.)
6. **Comments on news**: keep campus discussion threads on third-party news, or make news read-only (Save/Share only) and reserve discussion for native posts? Affects how much of `news_comments` we keep.
7. **Read-time**: do you want a real read-time? If yes we must store the source article's word count at fetch time (the publisher body, not the summary). Otherwise I'll omit it rather than fake it.
