# 04 - Trending Hashtags (world-class + real)

Area owner doc. Make Collab47 trending behave like Twitter/X "What's happening", Instagram Explore tags, and LinkedIn "Today's top news / trending" - real counts, real velocity, and field-relevant personalisation driven by the same classical matching engine the feed already uses (`lib/ranker/*` + `lib/db/feed.ts`).

Reference for sizing: this is a campus network, not global Twitter. "Trending" means "accelerating in the recent window across the network, with your field floated up", not "all-time most used".

---

## 1. CURRENT STATE (what exists, what is broken / dead / fake)

### 1a. Trending is computed inline, twice, two different ways, with no velocity and no real window control

**Home right rail** - `app/(app)/home/page.tsx:61-72`:
```ts
// Trending hashtags from the live "for you" pool
const counts = new Map<string, number>();
for (const p of forYouRaw) {
  for (const t of p.hashtags ?? []) {
    const tag = t.toLowerCase();
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
}
const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count }));
```
This counts tag occurrences across **at most 20 personalised "for you" posts** (`getForYouFeed(20)` at line 33). So:
- The "count" shown ("N posts") is **not** the real number of posts using the tag. It is "how many of your 20 for-you posts happened to carry this tag". A tag used by 4,000 posts and a tag used by 2 can show identical counts. This is effectively **fake data presented as a real count**.
- There is **no time window** beyond whatever `getForYouFeed` recalled, **no velocity / acceleration**, and **no de-noising** (a single prolific poster spamming `#test` dominates).
- It is recomputed on every render of `/home` (force-dynamic), so it also costs work each load.

**Explore card** - `app/(app)/explore/page.tsx:50-60`:
```ts
const counts = new Map<string, number>();
for (const p of popular) { for (const t of p.hashtags ?? []) { ... } }
const trending = [...counts.entries()].sort(...).slice(0, 5)...
```
Same Map-count technique but over a **different** pool (`getPopularFeed(40)`, last 24h by engagement-per-impression, line 8 + 45). So **home and explore show different "trending" lists** for the same user at the same moment. There is no single source of truth.

Net: trending is two separate, inconsistent, window-less occurrence counts. Not real, not personalised, not velocity-aware.

### 1b. Dead tables: `hashtags` + `post_hashtags` are never written (so `use_count` is always 0)

The schema already has the right tables, with RLS and indexes:
- `supabase/migrations/0001_init.sql:267-277` - `public.hashtags (tag pk, use_count int default 0, created_at)` and `public.post_hashtags (post_id, tag, pk)`.
- `supabase/migrations/0002_rls.sql:151-156` - read-all policies + `ph_insert_post_owner`.

But **nothing ever inserts into them**. `createPost` (`lib/db/posts.ts:145-165`) writes only the `posts.hashtags` text-array column; it never upserts `hashtags.use_count` or `post_hashtags`. `repostPost` (`lib/db/engagement.ts:218`) and `home/actions.ts:82-86` likewise only set the array. Grep confirms the **only reads** of `hashtags` are `social.ts:408` (search) and the **only writes** are the post-row array. So:
- `use_count` is permanently `0` for every tag.
- `searchAll(...)` (`lib/db/social.ts:392-417`) selects `hashtags.select("tag, use_count")` - hashtag search results are effectively empty / always show 0 uses. This surfaces in `ExploreSearch.tsx:145` and is **dead/fake** in the UI.

This is the single biggest fix: there is no durable tag table being maintained, so any honest "X posts use #tag" and any cheap trending query is impossible today.

### 1c. Link inconsistency: tag chips go to two different destinations

- Home trending links to **`/explore?q=%23${tag}`** (`home/page.tsx:93`) - i.e. it routes to search, not to the tag page.
- Explore trending links to **`/t/${tag}`** (`explore/page.tsx:130`).
- PostCard tag chips link to **`/t/${t}`** (`components/composite/PostCard.tsx:474`).
- ExploreSearch hashtag results link to **`/t/${h.tag}`** (`ExploreSearch.tsx:145`).

So clicking the same `#react` in different places lands you in different UIs. The canonical destination should be `/t/[tag]`. Home is the odd one out.

### 1d. The `/t/[tag]` page is thin and reverse-chronological only

`app/(app)/t/[tag]/page.tsx`:
- Fetches up to 40 posts `.contains("hashtags",[tag])` ordered by `created_at desc` (lines 25-32). No ranking, no related tags, no "people who post this", no follow-tag, no count of total posts (it shows `posts.length` = the 40-cap, not the real total - line 51, mildly misleading).
- Header is fine visually (`Hash` icon + serif title) but there is no engagement/velocity context, no "Top vs Latest" toggle (Instagram/X both have this), no related/sibling tags from the taxonomy.

### 1e. No personalisation of trending to the viewer's field

The feed engine personalises heavily (interests, `expandTags`/`semanticMatch` taxonomy, branch/college cohort, behaviour affinity, velocity - `lib/db/feed.ts`, `lib/ranker/taxonomy.ts`, `lib/ranker/features.ts`). **None of this touches trending.** Twitter/X shows "Trending in India" plus "Trending for you"; LinkedIn floats your-industry topics. Collab47 shows the same flat occurrence list to everyone.

### Contrast note (current)
Visually the trending cards are OK contrast: `text-ink` on `card` (white/cream), `text-ash #5A6A86` for counts on white passes AA. The `&middot;` separators use `text-bone #DDE3EE` on white in the daily-brief card (`home/page.tsx:172`) - that is decorative only, acceptable. No blended-invisible offenders in the trending cards specifically. The real problem here is **honesty of the numbers**, not contrast.

---

## 2. TARGET (what world-class + real looks like)

A single, real, cached, personalised Trending system with one canonical computation and one canonical destination.

**Real-system reference:**
- **Twitter/X "What's happening"**: ranked list, "N posts", a category/context line, refreshes on a window (not all-time), has both location-trends and for-you trends. Trends are about **velocity** (spiking now), de-duplicated, spam-suppressed.
- **Instagram Explore / tag page**: tag header with **total post count**, a **Top vs Recent** split, and a grid of the best posts for that tag.
- **LinkedIn**: "Trending now" with a one-line "why this matters" and your-industry weighting.

**Collab47 target:**
1. **One real trending engine** - `lib/db/trending.ts` - that computes a ranked tag list over a recent window using **velocity (acceleration), not raw count**, with a count that is the **honest number of posts in-window**, then personalises by floating up tags relevant to the viewer's field via the existing taxonomy (`semanticMatch` / `expandTags`) and behaviour affinity (`feed_events`).
2. **Durable tag stats** so counts are real and cheap: maintain `hashtags.use_count` and a rolling-window stat (via the new `post_hashtags` writes + a lightweight materialized view / aggregation). No more "count of my 20 for-you posts".
3. **One world-class Trending UI** component used by both home rail and explore, showing rank, tag, real in-window post count, a velocity indicator ("rising"/spike arrow), and a personalised "in your field" badge where applicable. Optimistic, instant, cached.
4. **Canonical `/t/[tag]` upgrade**: real total count, Top vs Latest toggle, related tags (taxonomy siblings), a "Follow tag" affordance (only if we ship tag-follows; see Open Questions), and a small stats strip (posts in 24h, contributors).
5. **All tag chips everywhere link to `/t/[tag]`** (fix home).

---

## 3. STEP-BY-STEP PLAN

Ordered so each step is shippable. Steps 1-3 make it REAL; 4-6 make it world-class; 7 personalises; 8 cleans up.

### STEP 1 - Make tag tables real: backfill + write on every post

**DB migration** `supabase/migrations/0027_trending.sql` (new; next number after `0026_neural_ranker.sql`). Applied live via the Management API like prior migrations; file is the repo record.

```sql
-- 0027_trending.sql ------------------------------------------------------
-- Make the dead hashtags/post_hashtags tables real, add window stats + RPC.

-- (a) Maintain post_hashtags + hashtags.use_count from posts.hashtags via trigger,
--     so every existing and future post keeps the tag tables in sync (no app code
--     can forget to write them).
create or replace function public.sync_post_hashtags()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare t text;
begin
  -- On insert/update of a live post, reconcile its tag rows.
  if (TG_OP in ('INSERT','UPDATE')) then
    -- ensure each tag exists, link it, bump counts for newly-added tags
    foreach t in array coalesce(new.hashtags, '{}') loop
      t := lower(trim(both '#' from t));
      if length(t) = 0 then continue; end if;
      insert into public.hashtags (tag) values (t) on conflict (tag) do nothing;
      insert into public.post_hashtags (post_id, tag) values (new.id, t)
        on conflict do nothing;
    end loop;
    -- remove links no longer present (edit path)
    delete from public.post_hashtags ph
      where ph.post_id = new.id
        and not (ph.tag = any (select lower(trim(both '#' from x)) from unnest(coalesce(new.hashtags,'{}')) x));
  end if;
  return new;
end $fn$;

drop trigger if exists trg_sync_post_hashtags on public.posts;
create trigger trg_sync_post_hashtags
  after insert or update of hashtags on public.posts
  for each row execute function public.sync_post_hashtags();

-- (b) use_count = live (non-deleted, non-expired) post count per tag, recomputed
--     cheaply. Keep it honest rather than a monotonic counter that drifts.
create or replace function public.recompute_hashtag_counts()
returns void language sql security definer set search_path = public as $fn$
  update public.hashtags h set use_count = sub.c
  from (
    select ph.tag, count(*)::int c
    from public.post_hashtags ph
    join public.posts p on p.id = ph.post_id
    where p.deleted_at is null and (p.expires_at is null or p.expires_at > now())
    group by ph.tag
  ) sub
  where sub.tag = h.tag;
  -- tags that fell to zero
  update public.hashtags h set use_count = 0
  where not exists (select 1 from public.post_hashtags ph
                    join public.posts p on p.id = ph.post_id
                    where ph.tag = h.tag and p.deleted_at is null);
$fn$;

-- (c) Backfill post_hashtags from existing posts.hashtags arrays, then counts.
insert into public.post_hashtags (post_id, tag)
select p.id, lower(trim(both '#' from t))
from public.posts p, unnest(p.hashtags) t
where length(lower(trim(both '#' from t))) > 0
on conflict do nothing;
insert into public.hashtags (tag)
select distinct tag from public.post_hashtags on conflict do nothing;
select public.recompute_hashtag_counts();

create index if not exists post_hashtags_tag_idx on public.post_hashtags (tag);
create index if not exists post_hashtags_post_idx on public.post_hashtags (post_id);
```

Outcome: `hashtags.use_count` and `post_hashtags` become real and self-maintaining. `searchAll` hashtag results (`social.ts:408`) start returning real counts immediately - no app change needed there. **Note:** the trigger keys off `posts.hashtags`, so the existing `createPost`/`repostPost`/`home/actions.ts` array writes are enough; no change required to those write paths (but see Open Question on edit support).

### STEP 2 - Real trending computation: `lib/db/trending.ts` (new)

This is the single source of truth. Velocity-based, windowed, honest counts, personalised. It reuses the engine's primitives.

**New RPC for the heavy aggregation** (add to `0027_trending.sql`): compute per-tag window stats in Postgres (cheap, indexed) instead of pulling rows into Node.

```sql
-- Per-tag trending stats: count in the recent window, count in the prior window
-- (for velocity), distinct authors (spam guard), and a recent-engagement sum.
create or replace function public.trending_tags(
  win_hours int default 24,
  max_tags  int default 40
) returns table (
  tag text, posts_window int, posts_prior int, authors int,
  engagement numeric, last_post timestamptz
) language sql stable set search_path = public as $fn$
  with recent as (
    select ph.tag, p.id, p.author_id, p.created_at,
           (p.like_count + 2*p.comment_count + 3*p.repost_count + p.bookmark_count) eng
    from public.post_hashtags ph
    join public.posts p on p.id = ph.post_id
    where p.deleted_at is null and (p.expires_at is null or p.expires_at > now())
      and p.created_at > now() - make_interval(hours => win_hours * 2)
  )
  select
    tag,
    count(*) filter (where created_at > now() - make_interval(hours => win_hours))::int,
    count(*) filter (where created_at <= now() - make_interval(hours => win_hours))::int,
    count(distinct author_id) filter (where created_at > now() - make_interval(hours => win_hours))::int,
    coalesce(sum(eng) filter (where created_at > now() - make_interval(hours => win_hours)),0),
    max(created_at)
  from recent
  group by tag
  having count(*) filter (where created_at > now() - make_interval(hours => win_hours)) > 0
  order by count(*) filter (where created_at > now() - make_interval(hours => win_hours)) desc
  limit max_tags * 3;  -- over-fetch; Node re-ranks by velocity + personalisation
$fn$;
```

**`lib/db/trending.ts`** (new file). Mirrors the style of `lib/db/feed.ts`.

```ts
import { getSupabaseServer } from "@/lib/supabase/server";
import { semanticMatch } from "@/lib/ranker/taxonomy";

export interface TrendingTag {
  tag: string;
  count: number;        // REAL posts-in-window count (honest)
  authors: number;      // distinct contributors (spam guard surfaced as "N people")
  velocity: number;     // 0..1 normalised acceleration vs prior window
  rising: boolean;      // velocity above threshold -> show the up-arrow
  forYou: boolean;      // personalised: relevant to viewer's field/interests
  score: number;        // final ranking score
}

export async function getTrendingTags(limit = 8, winHours = 24): Promise<TrendingTag[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  // Viewer field context for personalisation (same source the feed uses).
  let interests: string[] = [];
  let branch: string | null = null;
  const behaviorTags = new Map<string, number>();
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const [{ data: prof }, { data: events }] = await Promise.all([
      sb.from("profiles").select("interests, branch").eq("id", user.id).maybeSingle(),
      // Behaviour affinity: tags of posts the viewer engaged with (same query
      // shape as feed.ts:71). Reused so "your field" reflects what you DO.
      sb.from("feed_events")
        .select("kind, posts!inner(hashtags)")
        .eq("user_id", user.id)
        .in("kind", ["click", "expand", "save", "dwell"])
        .order("created_at", { ascending: false }).limit(300),
    ]);
    interests = (prof?.interests as string[]) ?? [];
    branch = (prof?.branch as string | null) ?? null;
    const W: Record<string, number> = { dwell: 1, click: 2, expand: 2, save: 4 };
    for (const e of (events ?? []) as Array<{ kind: string; posts?: { hashtags?: string[] } }>) {
      const w = W[e.kind] ?? 1;
      for (const t of e.posts?.hashtags ?? [])
        behaviorTags.set(t.toLowerCase(), (behaviorTags.get(t.toLowerCase()) ?? 0) + w);
    }
  }
  const maxBeh = Math.max(1, ...behaviorTags.values());
  const fieldTags = [...interests, ...(branch ? [branch] : [])];

  const { data: rows } = await sb.rpc("trending_tags", { win_hours: winHours, max_tags: limit });
  const raw = (rows ?? []) as Array<{
    tag: string; posts_window: number; posts_prior: number; authors: number; engagement: number;
  }>;
  if (raw.length === 0) return [];

  // Velocity = growth of this window over the prior window (acceleration), Laplace-
  // smoothed so a brand-new spike (prior=0) still scores high but not infinite.
  const velRaw = raw.map((r) => (r.posts_window + 1) / (r.posts_prior + 1) - 1);
  const vMax = Math.max(1e-6, ...velRaw.map((v) => Math.max(0, v)));

  const scored: TrendingTag[] = raw.map((r, i) => {
    const velocity = Math.max(0, velRaw[i]) / vMax;          // 0..1
    // Spam guard: a tag carried by one author is suppressed (authors weight).
    const breadth = Math.min(1, r.authors / 4);
    // Personalisation: taxonomy semantic match of the tag to the viewer's field +
    // their behaviour affinity. Same engine as the feed (lib/ranker/taxonomy).
    const sem = fieldTags.length ? semanticMatch(fieldTags, [r.tag]) : 0;
    const beh = (behaviorTags.get(r.tag.toLowerCase()) ?? 0) / maxBeh;
    const personal = Math.max(sem, beh);                     // 0..1
    // Final blend: real popularity (log) + velocity + breadth + personalisation.
    const popularity = Math.log10(r.posts_window + 1);
    const score = 0.9 * popularity + 0.8 * velocity + 0.4 * breadth + 0.6 * personal;
    return {
      tag: r.tag, count: r.posts_window, authors: r.authors,
      velocity, rising: velocity > 0.5 && r.posts_window >= 3,
      forYou: personal >= 0.5, score,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
```

Why this is honest + world-class:
- `count` is the **real** number of in-window posts using the tag (from the DB aggregate), not a sample artefact.
- `velocity` is real acceleration (this window vs the prior equal window), exactly the "spiking now" notion Twitter uses, computed the same spirit as `feed.ts:222-229`.
- Spam/single-author suppression via `breadth` (distinct authors).
- Personalisation reuses `semanticMatch` (`lib/ranker/taxonomy.ts:88`) and the same `feed_events` behaviour-affinity query as the feed - so trending is personalised by the **same classical matching engine**, satisfying the constraint to extend that approach to trending.

### STEP 3 - Cache it (so it is not recomputed per render and feels instant)

- Wrap `getTrendingTags` body that does the RPC + global ranking in Next's `unstable_cache` (or a small in-process TTL cache keyed by `winHours`) with `revalidate: 300` (5 min) for the **non-personalised** global part. Personalisation (field overlap, behaviour) is applied **after** the cached global list in a cheap pure function, so each user still gets their own ordering without recomputing the DB aggregate.
- Refactor: split into `getGlobalTrending(winHours)` (cacheable, no `user`) returning `{tag,count,authors,velocity}[]`, and `personaliseTrending(global, viewerCtx)` (pure). `getTrendingTags` composes them. This keeps the heavy query cached site-wide and the per-user step trivial -> matches the perceived-latency requirement.
- Optional belt-and-braces: add a pg_cron line (commented, like `0003`) to `select public.recompute_hashtag_counts()` every 30 min and to refresh any future MV.

### STEP 4 - One world-class Trending UI component

**New** `components/composite/TrendingTags.tsx` (client component for instant nav + optional refresh; data passed as a prop from the server pages).

Props: `tags: TrendingTag[]`, `variant?: "rail" | "card"`, `title?: string`.

UI (cobalt editorial, high contrast):
- Header row: `TrendingUp` saffron icon + uppercase tracking-widest `text-ash` label "Trending" (matches existing rail style at `home/page.tsx:85-88`).
- Each row is a `Link href={/t/${tag}}`:
  - Rank numeral in serif (explore already does this nicely, `explore/page.tsx:133`) - keep for the `card` variant; omit for slim `rail` variant.
  - `#tag` in `text-ink` -> `group-hover:text-saffron` (AA on white, high contrast).
  - Meta line: real `{count} posts` + `{authors} people` in `text-ash` (`#5A6A86`, AA-pass on white/cream). Honest plural handling.
  - **Velocity affordance**: if `rising`, a small up-trend chip - `ArrowUp` (lucide) in `text-moss #047857` with "Rising" - moss on white passes AA. (Do NOT use low-contrast pastels.)
  - **"In your field" badge**: if `forYou`, a tiny saffron pill (`bg-saffron/10 text-saffron-dk` = the existing `Tag variant="saffron"`, `Tag.tsx:13`). `saffron-dk` on `saffron/10` is high-contrast.
- Empty state: honest copy "No trends yet. Post something with a #hashtag to start one." (reuse explore's line, `explore/page.tsx:150`).
- "See all" -> link to `/explore#trending` (or a dedicated `/trending` page - see Open Questions).

Wire-in:
- `app/(app)/home/page.tsx`: delete the inline counts block (lines 61-72) and the inline `trendingCard` JSX (82-105). Replace with `const trending = await getTrendingTags(6);` added to the `Promise.all` (line 31), and render `<TrendingTags tags={trending} variant="rail" />`. **Fix the link** so it no longer goes to `/explore?q=%23...`.
- `app/(app)/explore/page.tsx`: delete the inline counts block (50-60); call `getTrendingTags(5)`; render `<TrendingTags tags={trending} variant="card" />` inside the existing "Trending now" `article` (replacing 125-152). Keeps the serif-rank look.

Result: home and explore show the **same** trending list (one source), with real counts, velocity, and personalisation.

### STEP 5 - Upgrade `/t/[tag]` to a real tag page

`app/(app)/t/[tag]/page.tsx` changes:
1. **Real total count + stats strip.** Add a parallel query: `sb.from("hashtags").select("use_count").eq("tag", tag).maybeSingle()` for the true total, and reuse `trending_tags`/a small count query for "posts in 24h" + distinct authors. Replace the misleading `posts.length` line (51) with the real `use_count`.
2. **Top vs Latest toggle** (Instagram/X parity). Add a `?sort=top|latest` searchParam.
   - `latest` = current behaviour (`created_at desc`).
   - `top` = rank the same candidate set with the engagement score used elsewhere (`engagementScore` lives in `feed.ts:21-24`; extract it to a shared `lib/ranker/engagement.ts` and import in both feed.ts and here so there is one definition). Render a small segmented control (high-contrast: active = `bg-ink text-cream`, inactive = `text-ash`).
3. **Related tags** from the taxonomy: `expandTags([tag])` (`lib/ranker/taxonomy.ts:60`) minus the tag itself -> render as `Tag` chips linking to their own `/t/[...]`. This is "you might also like" using the existing matching graph, zero new infra.
4. Keep the header (Hash + serif title) - good contrast already. Add the stats strip below it (`text-ash`).
5. **Follow-tag** affordance: only if we ship tag-follows (Open Question 1). If yes, a `Follow` button (optimistic) writing to a new `tag_follows` table; the feed recall in `feed.ts` would then add `.overlaps("hashtags", followedTags)`. If no, skip - do not ship a dead button.

### STEP 6 - Canonicalise all tag links to `/t/[tag]`

- `app/(app)/home/page.tsx:93` - change `href={/explore?q=%23${...}}` to `href={/t/${tag}}` (handled inside `TrendingTags`).
- Audit confirms PostCard (`:474`), ExploreSearch (`:145`), explore (`:130`) already use `/t/`. Leave them; just align home. No `/explore?q=%23` callers remain after this.

### STEP 7 - Personalisation surfaces ("Trending" vs "Trending in your field")

In the `card` variant on explore, optionally render two short sections like Twitter ("For you" + general): top 3 where `forYou` first, then general. Cheap because both come from the one `getTrendingTags` call (split by the `forYou` flag). Keep it to ONE list on the slim home rail to avoid clutter.

### STEP 8 - Cleanup / honesty pass

- Remove both inline counting blocks (home + explore) entirely so there is no second, wrong definition of "trending" left in the tree.
- Ensure `searchAll` (`social.ts:392`) now shows real `use_count` (free after Step 1) - verify the ExploreSearch hashtag rows render the count.

---

## 4. OPTIMISTIC-UI / PERF NOTES

- **Global trending is cached** (Step 3, `unstable_cache` revalidate 300s) so the expensive DB aggregate runs at most every 5 min site-wide, not per render. Per-user personalisation is a pure in-memory pass over <=120 rows -> negligible. This directly removes the per-load recompute that exists today.
- **The DB does the aggregation** (`trending_tags` RPC over indexed `post_hashtags`) instead of pulling 20-120 post rows into Node and Map-counting -> less data over the wire, faster TTFB on `/home` and `/explore`.
- **Instant navigation**: `TrendingTags` rows are `next/link` -> client-cached prefetch; clicking a tag feels instant. The `/t/[tag]` page's Top/Latest toggle is a client segmented control that swaps via shallow routing / `router.replace(?sort=)` with the already-rendered list kept while the new sort streams (optimistic: highlight the chosen segment immediately, then reconcile).
- **Optional live refresh**: `TrendingTags` can expose a tiny "refresh" that re-fetches the cached server action - optimistic spinner, swap on resolve. Not required for v1.
- No interaction in this area mutates user state except (optional) Follow-tag, which must be **optimistic**: toggle the button to "Following" instantly, write in the background, roll back on error - mirror the existing `followUser` fire-and-forget pattern in `social.ts:64-88`.

## 5. HONESTY + CONTRAST NOTES

- **Fake count -> real count**: today's "N posts" is a sample artefact (count within 20 for-you posts). After Steps 1-2 it is the true in-window post count from the DB. This is the core honesty fix.
- **Dead tables -> live**: `hashtags`/`post_hashtags` were schema-only ghosts (0001) never written. Step 1's trigger + backfill makes them real, which also un-breaks `searchAll` hashtag results (currently always `use_count = 0`).
- **Two-source inconsistency -> one source**: home and explore currently disagree; after the refactor both call `getTrendingTags`.
- **Velocity is real**: computed from this-window vs prior-window post counts in SQL, not faked.
- **Contrast**: all new chips use AA-passing tokens - `text-ink`/`text-ash` on white/cream, `text-moss #047857` for "Rising", `text-saffron-dk` on `saffron/10` for "in your field". No pastel-on-pastel, nothing blended into the background. The only existing low-contrast element near this area (`text-bone` middots in the daily-brief card) is decorative and out of scope; flagged but not changed.
- No em dashes, no Hindi-only strings, honest copy in empty states.

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. **Tag follows?** Do we want users to follow a hashtag (so it boosts their feed and shows a Follow button on `/t/[tag]`)? If yes I will add a `tag_follows` table + optimistic button + feed recall hook. If no, I will not ship a dead button.
2. **Dedicated `/trending` page?** Twitter/X has a full "Trending" screen. Do we want one (good for SEO + a real "See all" target), or is the home rail + explore card enough for v1 ("See all" -> `/explore#trending`)?
3. **Window length.** Default trending window is **24h** (good for a campus network's volume) with velocity vs the prior 24h. Twitter uses tighter windows. Do you want 24h, or a shorter "last 6h" hot window (we already have a 6h notion in `feed.ts`/`trending_posts` MV)? I can expose both as "Now" (6h) and "This week".
4. **Minimum thresholds.** Suppress tags with `< N` posts or `< 2` authors so a single poster cannot manufacture a trend. Proposed: hide tags with fewer than 2 distinct authors from the global list. OK?
5. **Should the home rail show personalised ("your field") or pure-global trending?** Proposal: personalised order with a small "in your field" badge, matching the rest of the app's matching-engine behaviour. Confirm.
6. **Edit support.** Posts appear permanent and there is no edit-hashtags path today; the Step 1 trigger handles edits defensively anyway. Confirm posts are not editable so I do not over-build.
