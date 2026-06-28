# 06 - Notifications: World-Class Overhaul Plan

Area owner: Notifications (Inbox). Scope: timestamp correctness, world-class UI
(grouping, read/unread, per-kind icons), optimistic mark-read, relevance/ordering,
and live (realtime) delivery. All data is REAL (Postgres `public.notifications`).

Reference systems: LinkedIn notifications tab (grouping by actor + day buckets,
"new"/"earlier" split, per-row dot, mark-all-read), Twitter/X (relative time +
absolute on hover, instant read clearing), Instagram (day-bucketed activity feed).

---

## 1. CURRENT STATE (real code, file:line evidence)

### Data model (correct, keep)
- `supabase/migrations/0001_init.sql:242-250` defines the table:
  ```sql
  create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    kind text not null,
    payload jsonb not null default '{}',
    read_at timestamptz,
    created_at timestamptz not null default now()
  );
  create index on public.notifications (user_id, created_at desc);
  ```
  `created_at` has `default now()`, so the stored insert time is correct.
- RLS: `0002_rls.sql:144-145` - `notif_read_own` (select own), `notif_update_own`
  (update own). Inserts are not granted to users, so `createNotification` uses the
  admin client (`lib/db/notifications.ts:62-86`).
- `0022_messaging_realtime_publication.sql:26-35` adds `notifications` to the
  `supabase_realtime` publication and sets `replica identity full`. The comment
  claims a client component `NotificationsList` subscribes - but no such component
  exists (grep for `NotificationsList` returns nothing). Realtime is provisioned
  but UNUSED. This is a dead/aspirational hook, not a working feature.

### THE TIMESTAMP BUG (root cause found)
The stored `created_at` is fine. The bug is in DISPLAY, in
`app/(app)/notifications/page.tsx:49`:
```ts
when: new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }),
```
Problems, each a real defect:
1. Computed on the SERVER. `toLocaleString` with no explicit `timeZone` uses the
   server's timezone (Vercel = UTC), not the viewer's. A like at 8:00 PM IST renders
   as "2:30 pm" (UTC) - this is exactly the "wrong / trash time" the founder sees.
2. It is an ABSOLUTE string baked at render time. There is no relative form
   ("2h ago") and no absolute-on-hover. Every other surface in the app shows
   relative time (`lib/ui/toCardPost.ts:4`, `CommentsSection.tsx:11`,
   `InShortsFeed.tsx:16`), so notifications look inconsistent and "off".
3. `en-IN` short format yields strings like `18/06/26, 2:30 pm` - dense and ugly,
   nothing like a clock. It never collapses to "now" / "5m" / "2h".
4. Because the page is `export const dynamic = "force-dynamic"`
   (`page.tsx:29`), the string is frozen at request time and never ticks; an open
   tab shows stale time until a full reload.

Then the row renders it raw: `NotificationItem.tsx` -> `<p ...>{item.when}</p>`
(the `when` field, line ~75). The component receives a pre-formatted string, so it
cannot show relative + absolute-on-hover even if we wanted to.

### THE DUPLICATE-NAME BUG (real, found while tracing payload)
`createNotification` stores BOTH `payload.who = actorName` and
`payload.text = "<actorName> reacted to your post"` (e.g.
`lib/db/social.ts:84-85` follow, `engagement.ts:39-41` like). The page maps
`who` and `text` separately (`page.tsx:47-48`), and `NotificationItem.tsx`
renders:
```tsx
<span className="font-semibold">{item.who}</span> {item.text}
```
So a real notification renders as **"Asha** Asha reacted to your post" - the actor
name is printed twice. This is a live, user-visible bug on every row.

### Mark-read / optimistic state (partly there)
- `MarkAllReadButton.tsx` - optimistic `done` flag, calls `markAllReadAction`
  (`actions.ts:9`) which does `revalidatePath("/notifications")` and
  `revalidatePath("/", "layout")` to drop the bell badge. The badge update waits on
  a full server round-trip + re-render (the ~1s lag the founder reports).
- `NotificationItem.tsx` - optimistic `read` flag, calls
  `markNotificationReadAction(id)` (`actions.ts:23`) which ALSO
  `revalidatePath("/", "layout")`. The row clears instantly (good), but the bell
  badge in `AppShell.tsx:165` does NOT decrement until the layout revalidates -
  and since navigation away happens immediately (`router.push(item.href)`), the
  badge often stays stale on the destination page. The badge is server-rendered in
  `app/(app)/layout.tsx:6` (`getUnreadCount()`), with no client-side optimistic
  count.

### Bell badge
- `app/(app)/layout.tsx:6` fetches `getUnreadCount()` and passes `unreadCount` to
  `AppShell`. `AppShell.tsx:63` -> `badge = >9 ? "9+" : count || null`. It is purely
  server-derived. No realtime, no optimistic decrement.

### Ordering / relevance
- `page.tsx:38-43` orders strictly by `created_at desc` limit 50. No relevance, no
  grouping, no "new vs earlier" buckets, no collapsing of repeat actors
  ("Asha and 3 others liked your post"). This is far below LinkedIn/X.

### Icons (good, keep)
- `page.tsx:11-27` `KIND_ICON` map covers follow, like, comment, comment_reply,
  repost, bookmark, mention, connection_request, dm, dm_request, project_invite,
  project_accepted, system. Reused per row (`page.tsx:96`). Keep this map; move to a
  shared module so the client list and the page agree.

### Contrast audit (this area)
- `page.tsx:67` "new" pill: `bg-saffron/10 text-saffron` on `cream`. Saffron is
  `#2C5BFF` (cobalt). `#2C5BFF` on a 10%-tint cobalt chip over cream is acceptable
  but borderline at 10px weight; verify >= 4.5:1 and bump tint to `/12` + use
  `saffron-dk` text if needed.
- `NotificationItem.tsx` row time `text-xs text-ash` (`#5A6A86` on `cream`/`paper`):
  ~5.0:1, passes. Unread row bg `bg-saffron/5` is a very faint tint - acceptable
  but the unread signal leans entirely on the tiny saffron dot; strengthen (see
  Target).
- No invisible text found, but the faint `bg-saffron/5` + `ring-cream` dot on a
  `paper` hover background can wash out; verify the dot ring contrasts on hover.

---

## 2. TARGET (world-class + 100% real)

A real activity inbox that:

1. **Shows the true interaction time, in the viewer's clock.** Relative by default
   ("now", "5m", "2h", "3d", "2w"), with the exact local timestamp on hover/title
   (e.g. `Thu, 18 Jun 2026, 8:04 PM`). Computed CLIENT-side from the raw ISO
   `created_at` so the timezone is the viewer's and it can re-tick. This matches X
   and the rest of Collab47 (`relativeTime` in `lib/ui/toCardPost.ts`).

2. **Day-bucketed, grouped, LinkedIn/X-style layout:**
   - Top split: **New** (unread) then **Earlier** (read), each a labeled section.
   - Within each, day buckets: "Today", "Yesterday", "This week", "Earlier".
   - Actor collapsing for the same target+kind: "Asha and 3 others reacted to your
     post" with stacked avatars (real names from existing `who` payload).

3. **Read/unread done right:** unread rows get a clear left accent rail + bolder
   text + dot; reading a row clears it INSTANTLY and decrements the bell badge
   INSTANTLY (shared client count), syncing in the background. "Mark all read"
   clears every row and zeroes the badge instantly.

4. **Live delivery (realtime):** the table is already in the realtime publication
   (`0022`). A small client subscription bumps the bell badge and prepends new rows
   the moment they arrive (same pattern as `MessageThread.tsx:94-155`). This makes
   the inbox feel alive without polling.

5. **Relevance-aware ordering, reusing the existing classical engine.** The feed
   already ranks with a zero-AI scorer (`lib/ranker/*`, `lib/db/feed.ts`). Apply the
   same recency + actor-affinity weighting so high-signal notifications (a
   connection request, a comment from someone you follow, a project invite) surface
   above low-signal ones (a like from a stranger) within the "New" bucket - while
   strict reverse-chron stays the default tiebreaker.

6. **No duplicate names**, honest copy, high contrast everywhere.

---

## 3. STEP-BY-STEP PLAN

### Step 0 - Shared time helper (fixes the core bug, dedupes 3 copies)
**Create** `lib/ui/time.ts`:
```ts
// Relative label: "now" | "5m" | "2h" | "3d" | "2w" | "Jun 18"
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  if (days < 28) return `${Math.floor(days / 7)}w`;
  // older than ~a month: short absolute date in the viewer's locale
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Full local timestamp for hover/title, e.g. "Thu, 18 Jun 2026, 8:04 PM"
export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// Day bucket key for grouping: "today" | "yesterday" | "week" | "earlier"
export function dayBucket(iso: string, now: number = Date.now()): "today" | "yesterday" | "week" | "earlier" { /* compare calendar days in local tz */ }
```
- Use `undefined` locale (viewer's locale), NOT `"en-IN"`. Honors the viewer's
  clock, fixing the timezone bug.
- Re-point `lib/ui/toCardPost.ts`, `components/composite/CommentsSection.tsx:11`,
  and `components/composite/InShortsFeed.tsx:16` to import from `lib/ui/time.ts`
  (delete their local copies). Out of strict scope but removes drift; if the
  founder prefers minimal blast radius, only notifications need the new module and
  the others can be a follow-up.

### Step 1 - Shared kind metadata module
**Create** `lib/ui/notificationKind.ts` exporting:
- `KIND_ICON` (moved from `page.tsx:11-27`).
- `kindWeight(kind: string): number` - relevance prior used in Step 6
  (connection_request/project_invite high, like/bookmark low).
Both the server page and the new client list import this so they never diverge.

### Step 2 - Fix the row component (timestamp + duplicate name)
**Edit** `components/composite/NotificationItem.tsx`:
- Change `NotificationItemData` to carry the RAW ISO and a clean message, not a
  pre-baked `when` string:
  ```ts
  export interface NotificationItemData {
    id: string;
    kind: string;
    message: string;   // already includes actor name, e.g. "Asha reacted to your post"
    who: string;       // actor name (for avatar only, NOT re-rendered in text)
    createdAt: string; // raw ISO from DB
    href: string;
    unread: boolean;
  }
  ```
- Render time as live relative + absolute-on-hover:
  ```tsx
  <time dateTime={item.createdAt} title={absoluteTime(item.createdAt)} className="text-xs text-ash">
    {relativeTime(item.createdAt)}
  </time>
  ```
  Wrap in a tiny `useState(Date.now())` + `setInterval(60_000)` tick (or a shared
  `NotificationsList` clock context) so open tabs re-render the relative label every
  minute. `title` + `<time dateTime>` gives the absolute-on-hover requirement and is
  semantic/accessible.
- Fix the duplicate name: render the message ONCE. The actor name already lives
  inside `message`; bold just the leading name span by splitting on `item.who`:
  ```tsx
  <p className="text-base text-ink">
    {item.message.startsWith(item.who)
      ? <><span className="font-semibold">{item.who}</span>{item.message.slice(item.who.length)}</>
      : item.message}
  </p>
  ```
  (Remove the old `<span>{who}</span> {text}` pattern entirely.)

### Step 3 - New client list with optimistic + realtime (`NotificationsList`)
**Create** `components/composite/NotificationsList.tsx` (`"use client"`), receiving
`initialItems: NotificationItemData[]` from the server page. Responsibilities:
- Hold items in `useState`; render grouped (Step 5).
- Optimistic mark-read per row: on click, flip `unread` locally, decrement the
  shared unread count (Step 4) BEFORE navigating, then fire
  `markNotificationReadAction(id)` in a transition. No layout revalidation needed
  for the badge because the count is client-managed.
- "Mark all read": flip every item to read locally + zero the count instantly, then
  call `markAllReadAction()`.
- Realtime subscription (mirror `MessageThread.tsx:94-171`):
  ```ts
  const sb = getSupabaseBrowser();
  const ch = sb.channel(`notifications:${userId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (p) => { prependItem(mapRow(p.new)); bumpUnread(+1); })
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (p) => { /* reconcile read_at across tabs */ })
    .subscribe();
  return () => sb.removeChannel(ch);
  ```
  This finally USES the realtime publication that `0022` set up (currently dead).
**Edit** `app/(app)/notifications/page.tsx` to fetch rows, map to
`NotificationItemData` (raw `createdAt`, `message = payload.text`, `who =
payload.who`), and render `<NotificationsList initialItems=... userId=... />`
instead of the inline `<ul>`. Drop `force-dynamic` is optional; keep it so the first
paint is fresh, realtime keeps it live after.

### Step 4 - Shared optimistic unread count for the bell badge
The badge lives in `AppShell` (`app/(app)/layout.tsx:6`, server count). To update it
INSTANTLY on mark-read without a layout round-trip:
- **Create** `components/layout/UnreadCountProvider.tsx` - a tiny React context
  (`{ count, setCount, decrement, zero, increment }`) seeded with the server
  `unreadCount`.
- **Edit** `app/(app)/layout.tsx` to wrap children in `UnreadCountProvider`
  initialValue={unreadCount}`.
- **Edit** `components/layout/AppShell.tsx:63-169` - read `count` from context
  instead of (or falling back to) the `unreadCount` prop; compute `badge` from it.
- `NotificationsList` and `NotificationItem` call `decrement()/zero()`; the realtime
  INSERT handler calls `increment()`. Result: badge reacts in 0ms, server
  `getUnreadCount()` remains the source of truth on next navigation.
- Keep the `revalidatePath("/", "layout")` calls in `actions.ts` as a
  belt-and-suspenders background reconcile, but the UI no longer waits on them.

### Step 5 - Grouping + buckets in `NotificationsList`
- Split items into `unread` and `read`. Render **New** section (if any unread) then
  **Earlier**.
- Inside each, group by `dayBucket(createdAt)` -> labeled subheaders
  ("Today" / "Yesterday" / "This week" / "Earlier"). Use existing typographic tokens
  (`text-caption`, `divide-bone`).
- Actor collapse: within the same `(kind, href)` and same day, if >= 2 distinct
  actors, render one row "Asha and N others ..." with stacked `Avatar`s (reuse
  `components/primitives/Avatar`). The `who` payload already gives real names; no
  fake data.

### Step 6 - Relevance ordering (reuse the classical engine)
- Within the **New** bucket only (Earlier stays pure reverse-chron), order by a
  blended score:
  `score = recencyDecay(createdAt) * 1.0 + kindWeight(kind) + actorAffinity(actorId)`.
  - `recencyDecay`: same half-life decay shape used in `lib/ranker/*` (import the
    existing helper if exported; otherwise add a thin wrapper that mirrors it - do
    NOT invent a new ranking philosophy).
  - `kindWeight` from `lib/ui/notificationKind.ts` (Step 1).
  - `actorAffinity`: reuse the follow/connection graph the feed ranker already
    consults so a comment from someone you follow outranks a like from a stranger.
- To support `actorAffinity`, store the actor id on the notification (Step 7) so we
  can join affinity without a name lookup. Keep `created_at desc` as the final
  tiebreaker so behavior is stable and explainable (no AI).

### Step 7 - DB: add `actor_id` to notifications (migration)
**Create** `supabase/migrations/0027_notifications_actor.sql`:
```sql
alter table public.notifications add column if not exists actor_id uuid references public.profiles(id) on delete set null;
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
-- (index above already exists from 0001; keep idempotent)
```
**Edit** `lib/db/notifications.ts` `createNotification` to accept and persist
`actorId` (every call site in `engagement.ts`, `social.ts`, `projects.ts`,
`messages.ts` already has `user.id` as the actor - pass it). Do NOT touch
`created_at` (the `default now()` is correct; explicitly NOT passing it is the right
call). Backfill is optional: existing rows simply have `actor_id = null` and fall
back to recency-only ordering.

### Step 8 - Contrast + copy polish
- Strengthen unread affordance in `NotificationItem`: add a `border-l-2
  border-saffron pl-2` accent rail for unread + keep the dot; bump unread bg to
  `bg-saffron/[0.06]`. Verify the dot ring contrasts on `hover:bg-paper`.
- "new" pill (`page.tsx:67` / moved into list): use `bg-saffron/12
  text-saffron-dk` to guarantee >= 4.5:1.
- Empty state copy stays honest: "Nothing yet." (keep `page.tsx:90`).

---

## 4. OPTIMISTIC-UI / PERF NOTES

- **Mark one read:** flip row + `decrement()` the context count synchronously, then
  navigate. Badge and row both change in 0ms; the server action runs in a
  transition in the background. (Today the badge waits on
  `revalidatePath("/","layout")` -> the ~1s lag.)
- **Mark all read:** flip all rows + `zero()` instantly; action runs in background.
- **Realtime:** new notifications arrive via Postgres changes (publication already
  set in `0022`), so no polling and no perceived delay. INSERT handler increments
  the badge and prepends the row.
- **Time never goes stale:** relative labels are client-computed and re-tick every
  60s; absolute is in the `title`/`<time dateTime>`.
- **Client cache / instant nav:** rows are real `<a href>` so Next prefetches and
  back/forward is instant; keep `e.preventDefault()` only for the plain
  left-click path (already correct in `NotificationItem.tsx`), letting
  modifier/middle clicks open new tabs.
- **First paint:** server still renders the initial 50 grouped rows so there is no
  empty flash; the client list hydrates over the same DOM.

## 5. HONESTY + CONTRAST NOTES

- **Fix the timezone "trash time" bug** (`page.tsx:49`): stop server-formatting with
  `en-IN`; compute client-side in the viewer's locale/timezone (Step 0/2).
- **Fix the duplicate actor name** ("Asha Asha reacted ...") in
  `NotificationItem.tsx` (Step 2). This is a real, shipping bug.
- **Activate the dead realtime hook:** `0022` provisions realtime + claims a
  `NotificationsList` subscriber that does not exist. Either build the subscriber
  (Step 3, recommended) or the migration's promise is fake. We build it - making it
  real, not removing it.
- **Relevance, not fake ranking:** reuse the existing classical `lib/ranker/*`
  scoring; do not introduce any AI or invented heuristic. Earlier bucket stays
  strict reverse-chron so it is fully explainable.
- **Contrast:** strengthen unread rail + "new" pill (Step 8); no invisible text
  exists today, but the unread signal is currently too subtle (relies on a 10px
  dot).
- **No em dashes, no Hindi-only strings, honest copy** preserved throughout.

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. Actor collapsing ("Asha and 3 others") - want it now, or ship per-row first and
   group in a fast-follow? It needs the `actor_id` column (Step 7) to be reliable.
2. Relative-time threshold for switching to absolute date: keep at ~28 days ("4w"
   then "Jun 18"), or show "w" up to 8 weeks like X?
3. Should reading a row also navigate (current behavior) or should there be a
   separate "mark read" affordance so users can keep unread as a to-do list (X lets
   you do both)? Current single-click = read + go.
4. Do we want a notification settings surface (mute likes, mute follows) now, or is
   that out of scope for this pass? `SettingsView.tsx` already references
   notifications.
5. Relevance reordering inside "New": acceptable to slightly break strict
   chronological order there, or must everything stay pure reverse-chron and we only
   add grouping? (LinkedIn reorders; X mostly does not.)
6. Backfill `actor_id` for historical rows (we can derive from `payload.who` ->
   profile lookup), or leave old rows recency-only?
