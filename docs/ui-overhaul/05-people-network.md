# 05 - People-to-Follow + Network Overhaul

Area owner: People-to-Follow, Suggestions, Connections graph, Network page.
Scope files: `app/(app)/network/**`, `lib/db/social.ts`, `components/composite/PersonCard.tsx`, `components/composite/NetworkTabs.tsx`, `components/composite/ConnectionRequests.tsx`, plus the suggestion render surfaces in `app/(app)/home/page.tsx` and `app/(app)/explore/page.tsx`, `components/composite/ProfileActions.tsx`, and the matching engine in `lib/ranker/*`.

This is a PLAN only. No app code is edited here.

---

## 1. CURRENT STATE (what exists, what is broken / dead / fake)

### 1a. The college-suggestion bug is REAL and confirmed

`getSuggestedConnections()` in `lib/db/social.ts:303-338`:

```
const { data: me } = await sb.from("profiles").select("college, branch, cluster_id")...
if (me?.college) {
  const { data } = await sb.from("profiles").select(cols)
    .eq("college", me.college)        // exact-string equality only
    .neq("id", user.id)
    .is("deleted_at", null).is("suspended_at", null)
    .limit(fetchLimit);               // NO .order(...) -> arbitrary DB order
  const filtered = (data...).filter((p) => !excluded.has(p.id));
  if (filtered.length > 0) return filtered.slice(0, limit);
}
// fallback: ANY users, no affinity at all
const { data } = await sb.from("profiles").select(cols).neq("id", user.id)...limit(fetchLimit);
return (...).filter(...).slice(0, limit);
```

Problems, with evidence:

- **No ranking. None.** Despite the prompt's claim that suggestions are "college-affinity ordered" (comment at `social.ts:331`), there is zero ordering inside the college query (`social.ts:319-325`) - the DB returns rows in physical/index order, then we `.slice(0, limit)`. Two people from "IISER Kolkata" are returned in essentially random order, and branch / interests / year / city are never consulted. The matching engine in `lib/ranker/*` is never imported by `social.ts`.
- **Exact-string match is brittle** (`social.ts:320`, `.eq("college", me.college)`). "IISER Kolkata" != "IISER, Kolkata" != "iiser kolkata". One typo or formatting difference and the user matches nobody, so the code silently falls through to the global fallback (`social.ts:332`) = genuinely random users. This is exactly the founder's symptom: college set to "IISER Kolkata", suggestions look random.
- **`cluster_id` is selected but never used** (`social.ts:316`). It is dead in this function. The column exists and is indexed (`0001_init.sql:22,36`) but nothing populates or reads it for suggestions.
- **`MiniProfile` is too thin to rank.** Interface at `social.ts:4-11` is `{ id, handle, name, avatar_url, college, branch }`. It does NOT carry `interests`, `year_of_study`, `city`, or `verified`, so even if we wanted to rank we have no features. The feed engine, by contrast, selects `college,branch,city,year_of_study,verified` for authors (`feed.ts:13`).
- **No "why suggested" reason** is ever produced or shown, unlike the feed which produces `reason[]` (`score.ts:6, 69-80`).

### 1b. The "Connect" action is MISSING from the entire network surface (dead/absent feature)

- `PersonCard.tsx` (the card used on the Network page and its suggestions, `network/page.tsx:116` and `NetworkTabs.tsx:94`) renders **only Message + Follow** (`PersonCard.tsx:82-122`, `152-189`). There is **no Connect button anywhere in PersonCard**. The only place a user can send a connection request is the profile page via `ProfileActions.tsx:114-134`.
- Consequence: the Network page is titled around "connections" (`network/page.tsx:49`, "{n} people in your orbit", Connections tab in `NetworkTabs.tsx:29`) but offers no way to actually create a connection from that page. The Connections tab can only ever be populated by going to individual profiles. This is a dead end.
- Suggested people on the Network page are passed `state={{}}` (`network/page.tsx:116`), so even their Follow button never reflects real state, and they show no Connect option.

### 1c. Reject / Cancel a connection is SILENTLY BROKEN at the database layer

- `cancelConnection()` (`social.ts:159-168`) and the reject path in `ConnectionRequests.tsx:31-37` call `sb.from("connections").delete()...`.
- **There is no DELETE row-level-security policy on `connections`.** RLS is enabled (`0002_rls.sql:10`) and only SELECT / INSERT / UPDATE policies exist (`0002_rls.sql:63-71`). Under Supabase RLS, a missing policy = deny. So the `.delete()` affects **0 rows and returns no error** (PostgREST delete of nothing is "success").
- Result: `ConnectionRequests` optimistically animates the card away (`ConnectionRequests.tsx:23-28`), the server action returns `{ ok: true }`, but the row is never removed. On refresh the rejected/cancelled request reappears. The same dead path affects "Cancel pending" in `ProfileActions.tsx:58-66`. This is fake success.

### 1d. Accept-connection integrity gap

- `connections_update_party` (`0002_rls.sql:69-71`) allows EITHER party to UPDATE, with no `with check`. `acceptConnection()` (`social.ts:129-157`) never verifies the accepter is not the original `requested_by`. So a user could "accept" their own outgoing request. Low severity but it is an integrity hole that the world-class flow must close.

### 1e. Optimistic UI is partial and the page is fully server-rendered (perceived lag)

- The whole Network page is an `async` server component (`network/page.tsx:15`) doing **seven** awaited queries before first paint: `getMyConnections` x3, `getPendingConnections`, `getSuggestedConnections`, `getMyProfile` (`network/page.tsx:16-24`), then a sequential 8th `getRelationshipStates` (`network/page.tsx:33`). Every Follow/Connect/Accept triggers `revalidatePath("/network")` (`actions.ts:13-15, 26-28, 41-52`), which re-runs all eight queries and refetches the server tree. That round trip is the ~1s lag the founder feels.
- `PersonCard` follow is optimistic locally (`PersonCard.tsx:33-47`) but uses `useTransition` + a server action whose `revalidatePath` re-renders the server component, so the optimistic state is correct yet the page still does a full refetch behind it.
- Connect has no optimistic state in PersonCard at all (because the button does not exist).
- `ConnectionRequests` accept/reject are optimistic (`ConnectionRequests.tsx:23-37`) but, per 1c, reject lies.

### 1f. Contrast / honesty issues in this area

- `network/page.tsx:55` Invite (`ShareButton`) is fine, but the "Find from college" CTA (`network/page.tsx:59-64`) jumps to `#suggested-cluster` which is the same randomly-ordered list - the label promises college matching the data does not deliver (honesty issue tied to 1a).
- Suggested-from-college header (`network/page.tsx:98-99`) claims "Suggested from {college}" while the list is not actually college-ranked (honesty).
- `ProfileActions.tsx:38` has `const mock = !targetUserId;` - a real "mock" disabled mode. It is honest (disables buttons when no real target) but the variable name and `opacity-60` styling can render a low-contrast ghost button; verify it is never shown to a signed-in viewer on a real profile.
- Empty-state and meta text uses `text-ash` (#5A6A86) on `bg-paper`/`bg-paper/60` (`network/page.tsx:109`, `NetworkTabs.tsx:84`, `ConnectionRequests.tsx:42`). #5A6A86 on #FFFFFF is ~4.7:1 (passes AA for normal text, barely). On `bg-paper/60` over cream it can dip below 4.5:1. Flag for audit; bump muted text to `text-ink/70` or darken ash where it sits on tinted backgrounds.

---

## 2. TARGET (world-class + 100% real)

Reference systems: **LinkedIn "People you may know" / "Grow your network"** (ranked by shared school, shared connections, same industry, with a one-line reason like "5 mutual connections / went to IISER Kolkata"), **Instagram "Suggested for you"** (followed-by + similar accounts), **Twitter/X "Who to follow"** (engagement + network affinity, instant follow toggle).

What "done" looks like:

1. **Suggestions are genuinely ranked by the same classical matching engine the feed uses.** Same-college, same-branch, same-city, year proximity, and interest/semantic overlap (via `lib/ranker/taxonomy.ts` `semanticMatch` and `lib/ranker/features.ts` `fieldProximity`) plus a **shared-connections / mutual-follow** graph signal (the people-equivalent of the feed's PPR). The founder at "IISER Kolkata" sees IISER Kolkata people first, then same-branch, then shared-interest, then mutuals - deterministic, explainable, real.

2. **Every suggested / network person card has real, instant Follow AND Connect**, with correct state (Follow / Following, Connect / Pending / Connected), mirroring `ProfileActions` but inline on the card and fully optimistic.

3. **Connection requests are real end to end**: send (instant Pending), accept (instant Connected + moves to Connections), reject/ignore (instant removal that actually deletes the row), cancel outgoing (actually deletes). A DELETE RLS policy makes reject/cancel real.

4. **A one-line "reason" chip** under each suggestion ("Same college", "Studies CSE too", "Likes AI/ML", "3 mutual connections"), exactly like LinkedIn, generated from the matching features - no fabrication, only true signals.

5. **Instant navigation + no full-page refetch on every action.** Optimistic local state for follow/connect/accept/reject; background sync; targeted revalidation only.

---

## 3. STEP-BY-STEP PLAN

### Step 0 - DB migration (new file `supabase/migrations/0027_connections_delete_policy.sql`)

Two fixes:

```sql
-- Reject / cancel a connection must actually delete the row.
create policy "connections_delete_party" on public.connections for delete using (
  auth.uid() = user_a_id or auth.uid() = user_b_id
);

-- Integrity: only the NON-requester can move a request to 'accepted'.
drop policy if exists "connections_update_party" on public.connections;
create policy "connections_update_party" on public.connections for update using (
  auth.uid() = user_a_id or auth.uid() = user_b_id
) with check (
  -- the user accepting must not be the one who requested it
  status <> 'accepted' or requested_by is null or auth.uid() <> requested_by
);
```

No schema/column changes are required for ranking because all ranking inputs (`college, branch, city, year_of_study, interests, verified`) already exist on `profiles` (`0001_init.sql:17-23`). We do NOT need `cluster_id`; we compute affinity at query time like the feed does.

(Optional, deferred) add an index to speed the mutual-connections query:
`create index if not exists follows_following_follower_idx on public.follows (following_id, follower_id);` - `follows` already has `(following_id)` (`0001_init.sql:145`) and PK `(follower_id, following_id)`, so this is only if the mutual query profiles slow.

### Step 1 - Widen `MiniProfile` so people can be ranked (`lib/db/social.ts`)

Add the cohort/affinity fields the ranker needs, and an optional reason:

```ts
export interface MiniProfile {
  id: string; handle: string; name: string;
  avatar_url: string | null;
  college: string | null; branch: string | null;
  // NEW - cohort + affinity inputs (mirror feed.ts:13 author select)
  city?: string | null;
  year_of_study?: string | null;
  interests?: string[] | null;
  verified?: boolean | null;
}

// Carried separately so we never put computed scores in the DB row type.
export interface RankedProfile extends MiniProfile {
  score: number;
  reasons: string[];      // ["Same college", "Studies CSE", "Likes AI/ML", "3 mutual connections"]
  mutuals: number;
}
```

Update every `const cols = "id, handle, name, avatar_url, college, branch"` (at `social.ts:178, 243, 307` and inside `getMyConnections`/`getPendingConnections`) to
`"id, handle, name, avatar_url, college, branch, city, year_of_study, interests, verified"` so cards have what they need.

### Step 2 - Build a people-ranking module (NEW file `lib/ranker/people.ts`)

Reuse the existing primitives instead of duplicating logic:

- import `fieldProximity` from `lib/ranker/features.ts` (gives sameCollege / sameBranch-weighted score / sameCity / year proximity - already exactly the people signal),
- import `semanticMatch` from `lib/ranker/taxonomy.ts` (interest overlap with cluster expansion),

```ts
import { fieldProximity } from "@/lib/ranker/features";
import { semanticMatch } from "@/lib/ranker/taxonomy";
import type { MiniProfile, RankedProfile } from "@/lib/db/social";

export interface PeopleScoreCtx {
  viewer: { college?: string|null; branch?: string|null; city?: string|null; year?: string|null; interests?: string[] };
  mutuals: Map<string, number>;   // candidateId -> shared-connection count
}

const clamp01 = (x:number)=>Math.max(0,Math.min(1,x));

export function scorePerson(p: MiniProfile, ctx: PeopleScoreCtx): RankedProfile {
  const fp = fieldProximity(
    { college: ctx.viewer.college, branch: ctx.viewer.branch, city: ctx.viewer.city, year: ctx.viewer.year },
    { college: p.college, branch: p.branch, city: p.city, year_of_study: p.year_of_study }
  );
  const sameBranch = !!(ctx.viewer.branch && p.branch &&
    ctx.viewer.branch.toLowerCase() === p.branch.toLowerCase());
  const interestScore = semanticMatch(ctx.viewer.interests ?? [], p.interests ?? []); // 0..1
  const mutual = ctx.mutuals.get(p.id) ?? 0;
  const mutualScore = clamp01(mutual / 5);           // 5+ mutuals saturates
  const verifiedBoost = p.verified ? 0.05 : 0;

  // Weighted blend mirroring the feed's "match" emphasis (score.ts:89).
  const score =
      0.45 * fp.score          // college/branch/city/year proximity
    + 0.25 * interestScore     // semantic interest overlap
    + 0.25 * mutualScore       // network/graph affinity (people-PPR)
    + verifiedBoost;

  const reasons: string[] = [];
  if (fp.sameCollege) reasons.push("Same college");
  if (sameBranch && p.branch) reasons.push(`Studies ${p.branch}`);
  if (interestScore >= 0.7) reasons.push("Shares your interests");
  else if (interestScore > 0) reasons.push("Related interests");
  if (fp.sameCity && !fp.sameCollege) reasons.push("Near you");
  if (mutual > 0) reasons.push(`${mutual} mutual connection${mutual>1?"s":""}`);

  return { ...p, score, reasons, mutuals: mutual };
}

export function rankPeople(cands: MiniProfile[], ctx: PeopleScoreCtx, limit: number): RankedProfile[] {
  return cands.map(c => scorePerson(c, ctx))
    .sort((a,b) => b.score - a.score)
    .slice(0, limit);
}
```

This is the same approach the feed uses (`features.ts` + `taxonomy.ts`), now applied to people - satisfying the "extend the same matching engine to people-to-follow / suggestions / connection ranking" constraint.

### Step 3 - Rewrite `getSuggestedConnections()` to recall-then-rank (`lib/db/social.ts:303-338`)

Replace the body (keep the signature, keep the exclude logic) with:

1. Load the viewer's full cohort row: `college, branch, city, year_of_study, interests` (not just `college, branch, cluster_id`).
2. **Recall pool (union, fuzzy, generous), not a single brittle `.eq`:**
   - `ilike("college", me.college)` instead of `.eq(...)` so "IISER Kolkata" tolerates trailing punctuation/case; optionally use `pg_trgm` (already enabled, `0025...:12`) via an RPC for true fuzzy, but `ilike` covers the immediate bug.
   - same-branch query: `.eq("branch", me.branch)` (cross-college branchmates).
   - same-city query: `.ilike("city", me.city)`.
   - interest-overlap query: expand viewer interests with `expandTagList` (from `taxonomy.ts`) and `.overlaps("interests", expanded)` (interests is `text[]`, `0001_init.sql:21`).
   - all four filtered by `deleted_at is null`, `suspended_at is null`, `neq id`, each `.limit(60)`; union into a `Map<id, MiniProfile>` (dedupe), like the feed's recall union (`feed.ts:124-165`).
   - Always also fetch a small recent-global batch (limit 30) so a brand-new account with no cohort still gets real suggestions (replaces today's random fallback, but now it is the LAST resort and still gets ranked).
3. **Mutuals map:** one query - `follows` where `follower_id in (myFollowingIds)` selecting `following_id` gives 2nd-degree counts; or for connection-mutuals, count shared accepted connections. Build `mutuals: Map<candidateId, count>`. Cap candidate set to ~150 before this query for cost.
4. Drop excluded ids (`getExcludedSuggestionIds`, already exists `social.ts:281-301`).
5. `rankPeople(pool, ctx, limit)` from Step 2. Return `RankedProfile[]` (suggestions) - callers that only need `MiniProfile` still work structurally; the new `reasons`/`score` are additive.

Net effect: the founder at "IISER Kolkata" now gets IISER Kolkata people ranked first (sameCollege weight 0.45), then branchmates, then shared-interest, then mutuals - real and explainable. The fallback only triggers for a truly empty cohort and is still ranked, never raw-random.

### Step 4 - Add real, optimistic Follow + Connect to `PersonCard` (`components/composite/PersonCard.tsx`)

- Extend `PersonCardState` (`PersonCard.tsx:17-21`) - it already has `isFollowing / isConnected / pending`. Add nothing structural; wire a Connect button.
- Add `import { requestConnectionAction, cancelConnectionAction } from "@/app/(app)/network/actions"` (follow actions already imported, `PersonCard.tsx:11-14`).
- Add local optimistic connection state alongside the existing `optimisticFollowing`:
  ```ts
  const [conn, setConn] = useState<"none"|"pending"|"connected">(
    state.isConnected ? "connected" : state.pending ? "pending" : "none"
  );
  const [connPending, startConn] = useTransition();
  function handleConnect() {
    if (conn === "connected") return;
    if (conn === "pending") { setConn("none"); startConn(async()=>{ const r=await cancelConnectionAction(person.id); if(!r.ok) setConn("pending"); }); return; }
    setConn("pending"); startConn(async()=>{ const r=await requestConnectionAction(person.id); if(!r.ok) setConn("none"); });
  }
  ```
- Render a **3-button row in both `row` and `grid` variants**: Message | Follow/Following | Connect/Pending/Connected, reusing the `Link2 / Clock / UserCheck` icon pattern already proven in `ProfileActions.tsx:114-134`. On narrow widths, collapse Message to an icon-only button so three fit (LinkedIn does this).
- **Reason chip:** if `person` is a `RankedProfile` with `reasons`, render the first 1-2 reasons as a small chip line under the branch/college line (`PersonCard.tsx:145-149` area). High-contrast: `bg-saffron/10 text-saffron-dk` (already used in `NetworkTabs.tsx:72`) - NOT ash-on-paper. Make `reasons` an optional prop so non-ranked uses (Followers/Following tabs) simply omit it.

### Step 5 - Pass real state to suggested cards (`app/(app)/network/page.tsx`)

- `getSuggestedConnections(8)` now returns `RankedProfile[]`. Compute their relationship states too: include suggested ids in the `getRelationshipStates` call (currently only followers+following, `network/page.tsx:30-33`). Pass `state={relStates[person.id] ?? {}}` and the reasons into `PersonCard` at `network/page.tsx:116` (replace `state={{}}`).
- Fix the header honesty: only label "Suggested from {college}" when the top suggestions actually have `sameCollege` reason; otherwise "People you may know" (`network/page.tsx:97-100`).
- Keep the horizontal scroller but ensure cards are the 3-button variant.

### Step 6 - Make Connections actionable from the Network page (`NetworkTabs.tsx`)

- The Connections / Followers / Following / Pending tabs already pass `stateFor()` (`NetworkTabs.tsx:37-50`). With Step 4, Followers cards now show a real Connect button (so the founder can connect with someone who follows him) and Following cards show real follow state - closing the "Connections tab is a dead end" gap.
- Add a count-aware empty state per tab that nudges to Suggested ("Nobody yet - see people from your college below") instead of the generic "Nothing here yet." (`NetworkTabs.tsx:84`).

### Step 7 - Fix reject/cancel for real (`ConnectionRequests.tsx`, `actions.ts`, `social.ts`)

- With the Step 0 DELETE policy, `cancelConnection().delete()` (`social.ts:165`) now actually removes the row. No code change needed in `cancelConnection` itself beyond confirming it returns the error if `error` is set (it does, `social.ts:166`).
- `ConnectionRequests.tsx` accept/reject already optimistic (`:23-37`); they will now be truthful. Add a notification on reject? No - LinkedIn does not notify on ignore. Leave silent (honest, matches real systems).
- `acceptConnection` (`social.ts:129-157`): add a guard so the accepter is not the requester (defense in depth matching the new RLS `with check`), and only flip rows where `status='pending'`.

### Step 8 - Targeted revalidation + optimistic-first (perf)

- In `actions.ts`, narrow `revalidatePath` usage. Today follow/unfollow revalidate `/network`, `/explore`, `/home` (`actions.ts:13-15, 25-28`) - three full server trees per click. Because the cards are now optimistic, drop the synchronous broad revalidation on follow/connect; revalidate only `/network` (the page being acted on) and let `/home`/`/explore` refresh on next natural navigation. Connection accept/reject revalidate only `/network`.
- This removes the ~1s "did it work?" gap: the card flips instantly (local state), the server confirms in the background, and we no longer re-render three pages on every tap.

### Step 9 - Apply ranking to the OTHER suggestion surfaces (home + explore)

- `home/page.tsx:108-135` ("People to follow") and `explore/page.tsx:155-185` ("People you may know") currently render a bare `Link` with avatar + name only - no follow/connect, no reason. Now that `getSuggestedConnections` returns ranked `RankedProfile[]`, render a compact inline **Follow** button (optimistic, reuse the PersonCard `row` variant or a slim FollowButton) and the top reason chip. This makes the matching engine visible everywhere people are suggested, consistent with the prompt's "extend the same matching/relevance to people-to-follow + suggestions".

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

- **Follow:** already optimistic in `PersonCard` (`:33-47`); keep, but stop the broad 3-page revalidation (Step 8). Target: button flips in < 16ms, server sync invisible.
- **Connect:** new optimistic `none -> pending` toggle (Step 4), mirroring the proven `ProfileActions` pattern (`:53-74`). Cancel pending is optimistic too.
- **Accept / Reject:** already optimistic in `ConnectionRequests` (`:23-37`); reject becomes truthful after Step 0. On accept, also optimistically MOVE the person into the Connections tab count without a refetch by lifting pending/connection state into a small client store or by accepting that the count updates on next navigation (acceptable; LinkedIn updates the badge async).
- **First paint:** the page does 8 awaited queries (`network/page.tsx:16-33`). Fold `getRelationshipStates` into the same `Promise.all` (it currently runs sequentially after, `:33`) so it is 7 parallel, not 7+1 serial. Consider streaming the Suggested section with `<Suspense>` so the Connections grid paints before the (heavier) ranked suggestions finish.
- **Client cache:** wrap follow/connect in `useTransition` (already done) and rely on Next's client router cache for instant tab/section navigation; do not `router.refresh()` after optimistic actions.
- **Ranking cost:** recall is 4-5 bounded `.limit(60)` queries unioned (same shape as the feed, `feed.ts:139-163`); ranking is pure JS over <=150 candidates - negligible. The only added query is the mutuals count (one `in(...)` over the viewer's follow list).

---

## 5. HONESTY + CONTRAST NOTES

Fake / dead / blended things this plan removes or makes real:

- **Random "college" suggestions -> real ranked suggestions** (Step 3). The current "college-affinity" comment (`social.ts:331`) is aspirational, not true today; the rewrite makes it true.
- **Missing Connect button -> real Connect everywhere** (Step 4-6). Today the Network page cannot create a connection at all.
- **Silently-failing reject/cancel -> real deletes** (Step 0). Today reject is fake success (no DELETE policy).
- **`state={{}}` on suggested cards -> real relationship state** (Step 5).
- **Honest labels:** only say "Suggested from {college}" when the data is actually college-ranked (Step 5); the "Find from college" CTA (`network/page.tsx:59-64`) now lands on genuinely college-ranked people.
- **No fabricated reasons:** reason chips are emitted only from true features (sameCollege, sameBranch, real mutual count, real interest overlap). No invented "5 mutuals".
- **Contrast:** reason chips use `bg-saffron/10 text-saffron-dk` (proven, `NetworkTabs.tsx:72`), never ash-on-paper. Audit muted `text-ash` (#5A6A86) where it sits on `bg-paper/60` (`network/page.tsx:109`, `NetworkTabs.tsx:84`, `ConnectionRequests.tsx:42`) and the suggested header (`:103`) - bump to `text-ink/70` or solid `bg-paper` so muted text stays >= 4.5:1. Verify the `ProfileActions` `mock` disabled state (`ProfileActions.tsx:38, 93/102/119` `opacity-60`) never renders to a signed-in viewer on a real profile (it should always have a `targetUserId`).
- No em dashes, no Hindi-only strings, no fabricated company facts introduced anywhere in the new copy.

---

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. **Connect vs Follow semantics.** Should "Connect" (mutual, requires accept) and "Follow" (one-way) both be first-class on every card (LinkedIn keeps both; Instagram/X only Follow), or do you want Connect to be the primary CTA and Follow secondary? This decides button order/prominence in `PersonCard`.
2. **Mutuals definition.** For "N mutual connections", do you mean shared *accepted connections*, shared *follows*, or both? (Affects which graph query we run in Step 3.)
3. **College normalization.** Is college a free-text field at signup, or a picked-from-list value? If free text, do you want a one-time normalization/migration (e.g. canonical "IISER Kolkata") so `ilike` is not the only safeguard? A canonical college list would make ranking and the `cluster_id` column finally meaningful.
4. **Should accepting a connection auto-follow** both directions (LinkedIn-style), or stay independent? Affects what `acceptConnection` writes.
5. **Reason chip verbosity.** One reason chip per card (cleanest) or up to two? And is showing "3 mutual connections" acceptable privacy-wise for a campus product, or college/branch reasons only?
6. **Cold-start fallback.** For a brand-new user whose college matches nobody yet, is showing recent/verified active users (ranked, labeled "New on Collab47") acceptable, or should the section stay empty until a real cohort exists?
