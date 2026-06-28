# 10 - Messaging / DM: World-Class Overhaul Plan

Area owner: Messaging / Direct Messages. Scope: a buttery-smooth DM surface with
instant inbox open, optimistic send (message appears the moment you hit Enter),
client-cached navigation between threads, polished motion, and zero regressions to
the REAL logic already in place (Supabase Realtime, the permission matrix in
`computeIsRequest`, groups, block / mute / requests, read receipts, image upload,
rate limit, moderation, notifications).

Reference systems (how the real ones feel):
- iMessage / WhatsApp: a sent bubble appears instantly with a tiny "sending" state,
  then resolves to a delivered/timestamp state; nothing ever blocks the input.
- Instagram DMs: opening a conversation is instant because the last-opened threads
  are cached client-side; the thread list never re-fetches from scratch on tab
  switch.
- Twitter/X DMs: the inbox list and the open thread coexist with a persistent left
  rail; switching conversations swaps only the right pane (no full reload).
- LinkedIn messaging: unread counts live on the nav and the rail and clear the
  instant you open a thread (optimistic), syncing in the background.

Brand: cobalt editorial. Own bubbles use `saffron` (#2C5BFF) with `cream` text;
peer bubbles use `paper` with `ink` text and a `bone` border. Display = Sora
(`font-serif`), body = Inter (`font-sans`).

---

## 1. CURRENT STATE (real code, file:line evidence)

### What exists and is REAL (keep all of it)
- Permission matrix: `lib/db/messages.ts:480-581` `computeIsRequest` - block list,
  existing-thread allow, accepted connections, project-author override,
  applicant->author gate, shared team, `dm_permission`, and a real BFS degree check
  (`isWithinDegree`, `lib/db/messages.ts:609-651`) over follows + connections. This
  is the same family of graph/relevance logic the feed ranker uses; do not touch the
  rules.
- Send path: `sendMessage` (`lib/db/messages.ts:653-771`) - rate limit
  (`overLimit`, line 670), moderation (`moderateContent`, line 676), group vs 1:1
  branch, insert, `last_message_at` bump, fire-and-forget notifications.
- Realtime: `MessageThread.tsx:90-175` subscribes to `postgres_changes` INSERT +
  UPDATE on `messages` filtered by `conversation_id`, plus a separate
  `typing:<id>` broadcast channel. Migration
  `0022_messaging_realtime_publication.sql` adds `messages` to the realtime
  publication with `replica identity full` (so `read_at` UPDATEs carry the full
  row). Typing indicator and "Seen" read receipts already work.
- Requests: accept (`acceptMessageRequest`, line 773), decline/delete
  (`declineMessageRequest`, line 816), inbound banner in the thread
  (`[chatId]/page.tsx:205-216`).
- Groups: `createGroupConversation` (line 435), `NewGroupModal.tsx`, group header.
- Block / mute: `ChatMenu.tsx`, `blockUser` / `unblockUser` / `muteConversation`.
- Image: client-side compress + upload to `message-media` Storage, only the public
  URL reaches the action; the action validates the URL prefix
  (`actions.ts:29-31`). Real and safe.

### What is BROKEN / laggy / not world-class (the founder's "~1s" complaints)

**A. Inbox open is slow and uncached (root cause of the ~1s).**
- `app/(app)/messages/page.tsx:5` is `export const dynamic = "force-dynamic"`, so
  every visit is a fresh server round trip; nothing is cached and there is no
  prefetch.
- The page calls `getMyConversations("main")` AND `getMyConversations("requests")`
  (`page.tsx:18-21`). Each call (`lib/db/messages.ts:67-171`) does: 1 query for
  memberships, then 1 big query that joins `conversation_members -> profiles` and
  `messages` for ALL conversations, then loops in JS sorting every conversation's
  messages to find the latest and counting unread. Running it TWICE doubles that.
- The **thread page repeats the entire inbox twice again**:
  `[chatId]/page.tsx:40-45` calls `getConversationMessages`, `getMyConversations("main")`,
  `getMyConversations("requests")`, and `getConversationHeader` on every thread open.
  So opening a single chat re-derives the whole conversation list (the left rail)
  from scratch, server-side, with no cache - this is most of the perceived latency
  when navigating between chats.
- There is no SWR / react-query / `useOptimistic` anywhere in the app
  (`grep useOptimistic` -> none; `grep swr|react-query` -> none). Messaging has no
  client cache layer at all.

**B. Send is NOT optimistic.** `MessageComposer.handleSubmit`
(`MessageComposer.tsx:99-154`) runs the whole thing inside `startTransition`:
optional image upload, then `await sendMessageAction(fd)`, then on success it
clears the input and calls `router.refresh()` (line 151). The just-sent bubble only
appears when EITHER the realtime INSERT round-trips back OR the `router.refresh()`
server re-render completes. On a slow link that is exactly the ~1s the founder
feels. The input clears only after the await resolves, so the textbox sits with your
text and a disabled send button during the wait.

**C. `router.refresh()` on every send re-runs the whole server page** (messages +
both inbox queries again). Heavy, and it fights the realtime channel that already
delivers the message. The code comments even admit it is a "fallback in case
realtime is unavailable" (`MessageThread.tsx:54-65`, `MessageComposer.tsx:148-151`).

**D. Accept / Decline / "View" request actions are not optimistic.**
`AcceptRequestButton.tsx:15-19` just awaits the action; the row does not move to the
inbox until the server revalidates. `DeclineRequestButton` same.

**E. Mute is optimistic but Block/Unblock are not** - `ChatMenu.block`
(`ChatMenu.tsx:54-67`) sets local state then `router.refresh()`es (full reload of
the page). The composer only flips to "you blocked this person" after that refresh.

**F. Scroll behavior is wrong on open.** `MessageThread.tsx:67-74` uses
`scrollIntoView({ behavior: "smooth" })` and fires it on mount AND on every
`messages` change. On first open you SEE the thread animate-scroll from top to
bottom (janky); when a new message arrives it smooth-scrolls even if you have
scrolled up to read history (hijacks your scroll). World-class clients jump
instantly to bottom on open, and only auto-scroll on new messages when you are
already near the bottom.

**G. No pagination / history.** `getConversationMessages` hard-limits to the latest
50 (`lib/db/messages.ts:175,187`). Older messages are silently unreachable - there
is no "load earlier" affordance. For an active thread this is a real data loss in
the UI.

**H. Realtime INSERT does an extra round trip per message.**
`MessageThread.tsx:104-123` fetches the sender profile from `profiles` for EVERY
inbound realtime message before showing it. For your own echoed message this is pure
waste (you already know your profile), and it delays even peer messages by a query.

**I. `<img>` for attachments** (`MessageThread.tsx:230-234`,
`MessageComposer.tsx:185-189`) - no `next/image`, no width/height, no skeleton, so
image messages cause layout shift and re-jump the scroll.

**J. Two divergent left-rail implementations.** The rail is hand-rolled twice:
`MessagesShell.tsx:119-145` (Links, with search + tabs + New group) and again inside
`[chatId]/page.tsx:121-147` (plain `<a>` tags, NO search, NO requests tab content,
NO New group button, uses full-page `<a>` navigation = full reload between chats).
They drift and the thread-page rail is the worse one. This is the single biggest
"feels like a website not an app" offender.

**K. Plain `<a href>` for thread navigation** in the thread-page rail
(`[chatId]/page.tsx:122`) forces a full document navigation instead of a client
transition - guaranteed full server re-render of everything in C above.

### CONTRAST / honesty audit (cobalt tokens)
- `text-ash` (#5A6A86) on `bg-cream` for the message timestamp and "Inbox/Requests"
  counts is borderline but passes; the **`text-cream/70` timestamp inside the saffron
  own-bubble** (`MessageThread.tsx:242`) is the real risk: 70% cream on #2C5BFF is
  low contrast. Bump to `text-cream/90` and the "· Seen" to full `text-cream`.
- Disabled send button at `opacity-40` (`MessageComposer.tsx:253`) on a saffron
  circle is intentional and fine (it is a control, not text), keep.
- The empty-state icons use `text-bone` on `bg-cream` (e.g.
  `MessagesShell.tsx:109`) - decorative, acceptable, but the empty-state copy uses
  `text-ash` which is fine.
- No fake/mock data found in messaging. Previews like `"Wants to connect"` /
  `"Photo"` (`messages.ts:162`) are honest fallbacks for a request with no body / an
  image-only message. Keep, but render "Photo" with a small image glyph so it reads
  as a media message, not literal text.
- No em dashes, no Hindi-only strings present. Keep it that way.

---

## 2. TARGET (world-class + 100% real)

A persistent two-pane messenger (rail + thread) that behaves like a native app:

1. **Instant inbox.** The conversation list is fetched once, cached client-side, and
   reused across every thread open. Switching chats swaps only the right pane via a
   client transition - never a full reload. First paint of the rail is served from
   cache while a background refresh reconciles.
2. **Optimistic send.** Pressing Enter renders your bubble immediately with a subtle
   "sending" state (clock glyph), clears the input instantly, keeps focus, and
   auto-scrolls. The server insert + realtime echo reconcile the temp bubble to its
   real id and timestamp. On failure the bubble shows a "Failed - tap to retry"
   state in `ember`; nothing is lost.
3. **Optimistic everything else.** Accept moves the request into the inbox list
   instantly; Decline removes the row instantly; Block flips the composer to the
   blocked state instantly; Mute already does. All reconcile in the background and
   roll back on error.
4. **Real scroll behavior.** Jump to bottom instantly on open (no animation). On a
   new message, auto-scroll only if already near the bottom; otherwise show a "New
   messages" pill that jumps down on tap (Instagram/WhatsApp behavior).
5. **History.** "Load earlier" loads older pages above without losing scroll
   position (keyset pagination on `created_at`).
6. **One rail component, used on both the index and the thread route.** No drift,
   client-side `<Link>` navigation, active-row highlight, search, tabs, New group,
   per-row unread dot + count.
7. **Live unread count on the nav + rail** sourced from real conversation data, that
   clears optimistically when you open a thread.
8. **Polished, restrained motion** consistent with the rest of the app (Sora display,
   Inter body, cobalt accents): bubble entrance, typing dots, request-row
   accept/decline slide-out, rail-row press states. Honor `prefers-reduced-motion`
   (already wired via `useReducedMotion`).

The matching/relevance engine connection: the inbox rail already orders by
`last_message_at` (recency). Extend relevance by adding a lightweight tie-breaker /
secondary sort that surfaces conversations with people in your network closer
(reuse the same follow+connection graph already loaded for `computeIsRequest`), so
the rail subtly mirrors the feed ranker's "who matters to you" signal. This is
optional polish (see Open Questions) and must stay 100% deterministic and real.

---

## 3. STEP-BY-STEP PLAN (ordered, concrete)

### Phase 0 - Shared client cache + realtime store (foundation for instant feel)

**Step 0.1 - Add a tiny messaging client store/provider.**
Create `components/messages/MessagesProvider.tsx` (`"use client"`). Responsibilities:
- Hold `conversations: ConversationListItem[]` and `requests: ConversationListItem[]`
  in React state, seeded from the server on first mount (passed as props).
- Persist a snapshot to `sessionStorage` under `c47:dm:inbox` (the app already uses
  `sessionStorage` in `lib/newsPersonalize.ts`, so this is an established pattern) so
  that the NEXT inbox open paints from cache in <16ms, then reconciles.
- Expose actions: `upsertConversationPreview`, `markConversationRead`,
  `moveRequestToInbox`, `removeConversation`, `bumpToTop`.
- Subscribe ONCE (app-level) to a realtime channel on the user's memberships so the
  rail's last-message/unread updates live even when no thread is open (mirrors
  WhatsApp). Filter: `messages` INSERT where `conversation_id in (my convs)`.

Wrap the messages routes with this provider. Easiest: add it in a new
`app/(app)/messages/layout.tsx` (server component) that fetches the inbox ONCE and
renders `<MessagesProvider initialInbox={...} initialRequests={...}>{children}</MessagesProvider>`.
This is the key structural change that kills the "inbox re-derived on every thread
open" cost in problem A/C.

**Step 0.2 - Move the inbox fetch out of the per-thread page.**
Edit `app/(app)/messages/[chatId]/page.tsx`:
- DELETE the two `getMyConversations(...)` calls (lines 41-42) and the two
  `.map(...)` blocks (lines 47-69). The rail now comes from `MessagesProvider`
  (already in memory), not a re-fetch.
- Keep `getConversationMessages(chatId)` and `getConversationHeader(chatId)` only.
- Net effect: opening a thread does TWO light queries instead of FOUR heavy ones.

**Step 0.3 - Single rail component.**
Create `components/messages/ConversationRail.tsx` (`"use client"`) by lifting the
good rail from `MessagesShell.tsx:46-147` (search, tabs, New group, unread dot).
- Reads conversations/requests from `MessagesProvider` (not props).
- Uses `next/link` `<Link prefetch>` for rows (NOT `<a>`), so navigation is a client
  transition.
- Highlights the active row via `usePathname()` matching `/messages/[id]`.
- Replace BOTH rail copies: `MessagesShell` becomes a thin wrapper that renders
  `<ConversationRail/>` + the empty right pane; the thread page
  (`[chatId]/page.tsx:97-149`) replaces its hand-rolled `<aside>` with
  `<ConversationRail activeId={chatId} />`. Deletes ~50 lines of divergent markup
  (problem J + K fixed).

### Phase 1 - Optimistic send (the headline fix)

**Step 1.1 - Lift messages state into the thread + add `useOptimistic`.**
Refactor `MessageThread.tsx` to accept `pending` messages and a send callback, OR
(cleaner) introduce a `useThreadMessages` hook in
`components/messages/useThreadMessages.ts`:
- State shape: real messages (from server + realtime) plus a `tempMessages` map keyed
  by a client `clientId` (uuid). Each temp message has
  `status: "sending" | "failed"` and a synthetic `created_at = now`.
- Merge order: realtime/server messages, then temp messages not yet reconciled,
  sorted by `created_at`.
- Reconciliation: when a server message arrives (via the action return id OR the
  realtime INSERT) whose `clientId` matches (see 1.2) OR whose `(sender_id, body,
  ~created_at)` matches a temp, drop the temp and keep the real row. De-dupe by real
  `id` is already handled (`MessageThread.tsx:127`); add clientId de-dupe.

**Step 1.2 - Thread a `client_id` through so echoes reconcile cleanly.**
- DB: add nullable `client_id text` (or `uuid`) to `public.messages` (migration
  below). The composer generates `crypto.randomUUID()`, shows the temp bubble with
  it, sends it in the FormData; `sendMessage` writes it to the row; the realtime
  INSERT payload carries it back, so the thread maps echo->temp deterministically
  (no fragile body/time matching). This is exactly how iMessage/Signal de-dupe
  optimistic sends.

**Step 1.3 - Rewrite `MessageComposer.handleSubmit` to be optimistic.**
Edit `MessageComposer.tsx:99-154`:
- BEFORE awaiting anything: generate `clientId`, push a temp message
  `{ clientId, body, image_url: localPreviewUrl, status: "sending", created_at: now,
  sender_id: currentUserId }` into the thread (via a callback / context dispatch),
  CLEAR the input, clear the image, keep focus on the textbox, scroll to bottom. This
  is the instant feel.
- THEN, off the critical path: upload image if any (keep the existing
  `prepareImageForUpload` flow, `MessageComposer.tsx:107-122`), call
  `sendMessageAction` with `clientId`. On `result.ok` mark the temp reconciled (the
  realtime echo or the returned id finalizes it). On `result.blockedReason` /
  failure, flip the temp to `status: "failed"` and surface the reason inline on the
  bubble with a Retry affordance (re-runs the send with the same clientId).
- REMOVE `router.refresh()` (line 151). The realtime channel + optimistic state now
  cover display; the rail updates via the provider (Step 1.5). Keep a single
  defensive refetch only if realtime is detected as down (optional).
- For `is_request` first messages, keep the existing hint ("Your message went to
  their requests", line 142) but show it as a small inline chip under the composer,
  not a full footer swap.

**Step 1.4 - Bubble "sending/failed" UI.**
In the bubble (`MessageThread.tsx:239-249`) add, for own messages:
- `status==="sending"`: replace the timestamp with a small spinning `Loader2` (or a
  clock glyph) in `text-cream/90`.
- `status==="failed"`: show `"Not delivered · Retry"` in a high-contrast pill
  (`bg-cream text-ember` inside the bubble, or below it) - never low-contrast.
- delivered (`read_at`): keep "· Seen" but bump to full `text-cream` (contrast fix).

**Step 1.5 - Update the rail optimistically on send.**
On optimistic send, call provider `bumpToTop(conversationId, { lastMessage: body ||
"Photo", lastMessageAt: now, unread: false })` so the rail reorders instantly, like
WhatsApp. Reconcile when the server confirms.

### Phase 2 - Optimistic requests, block, read

**Step 2.1 - Optimistic Accept/Decline.**
`AcceptRequestButton.tsx`: on click, call provider `moveRequestToInbox(convId)`
(removes from requests, inserts into inbox, decrement requests badge) BEFORE/at the
same time as `acceptRequestAction`; roll back on `!ok`. Animate the row out with a
`motion` height/opacity collapse.
`DeclineRequestButton.tsx`: optimistic `removeConversation(convId)` + slide-out, then
`declineRequestAction`; restore on failure.

**Step 2.2 - Optimistic Block/Unblock in `ChatMenu`.**
`ChatMenu.block` (`ChatMenu.tsx:54-67`): keep local `setBlocked(true)` but instead of
`router.refresh()`, dispatch a context event so the composer flips to the blocked
footer immediately (no reload). Reconcile via the action result. Same for `unblock`.

**Step 2.3 - Optimistic mark-read.**
`MessageThread.tsx:77-87` already fires `markReadAction` on mount. Add: on mount,
also call provider `markConversationRead(conversationId)` so the rail dot + nav badge
clear instantly (problem: today they only clear after a server revalidate). Keep the
server call for persistence.

### Phase 3 - Scroll, history, motion polish

**Step 3.1 - Fix scroll behavior** (`MessageThread.tsx:67-74`):
- On first mount: `bottomRef.current.scrollIntoView({ behavior: "auto" })` (instant,
  no animation) inside a `useLayoutEffect` so there is no visible top->bottom slide.
- Track `isNearBottom` (scroll listener, threshold ~120px). On new message:
  auto-scroll only if `isNearBottom` OR the new message is your own optimistic send.
  Otherwise increment a `newCount` and render a floating "N new messages" pill
  (saffron, high contrast) that scrolls down on tap.

**Step 3.2 - "Load earlier" pagination.**
- Add `getConversationMessages(conversationId, { before?: string, limit })` keyset
  variant in `lib/db/messages.ts` (use `.lt("created_at", before)`); expose a server
  action `loadEarlierAction(conversationId, beforeIso)`.
- In the thread, when scrolled to the top and more may exist, show a "Load earlier"
  button (or auto-load via an IntersectionObserver sentinel). Prepend results while
  preserving scroll position (measure `scrollHeight` before/after).

**Step 3.3 - Avoid the per-message profile round trip** (`MessageThread.tsx:104-123`):
- For your OWN echoed inserts (`sender_id === currentUserId`), attach the known
  `me` profile (pass `me` into the thread) instead of querying `profiles`.
- For groups, keep a small in-memory `Map<senderId, MiniProfile>` seeded from the
  loaded messages and only query for a sender not seen yet. Cuts latency on inbound
  messages.

**Step 3.4 - Images** (`MessageThread.tsx:230-234`):
- Render with `next/image` (or at minimum fixed aspect-ratio container + skeleton)
  so image messages do not cause layout shift / scroll jump. Add a click-to-zoom
  lightbox (reuse any existing modal pattern; else a simple `motion` overlay).

**Step 3.5 - Motion** (consistent, reduced-motion-aware):
- Bubble entrance: keep the existing `motion.div` (`MessageThread.tsx:206-211`) but
  only animate the LAST appended message, not the whole list on every state change
  (wrap in `AnimatePresence` keyed by id; set `initial={false}` for already-mounted
  rows to avoid re-animating history on re-render).
- Request row accept/decline: `AnimatePresence` collapse.
- Rail rows: subtle `active:scale-[0.99]` press (already partly present).
- Typing dots: keep (`MessageThread.tsx:258-266`).

### Phase 4 - Nav / rail unread count (real)

**Step 4.1 - Real conversation unread count.**
Add `getMessageUnreadCount()` in `lib/db/messages.ts` (sum of per-conversation
unread from the same data `getMyConversations` already computes; expose a cheaper
COUNT query). Surface it on the Messages nav item in `AppShell.tsx` (today only
notifications drive `unreadCount`, `app/(app)/layout.tsx:6`) and on the rail tab.
Clear it optimistically via the provider on thread open (Step 2.3).

### DB / migrations needed
- **New migration `00XX_message_client_id.sql`:**
  ```sql
  alter table public.messages add column if not exists client_id text;
  create index if not exists messages_client_id_idx on public.messages (client_id);
  ```
  `replica identity full` is already set (`0022_...:34`), so the realtime echo will
  include `client_id`. No RLS change needed (column is sender-written, already
  covered by existing message insert policy).
- No other schema changes. `conversation_members.last_read_at`, `muted`,
  `messages.read_at`, `is_request`, `image_url` all already exist
  (`lib/supabase/types.ts:121-138`).
- Update `Message` interface (`lib/supabase/types.ts:129-138`) to add
  `client_id: string | null`.

---

## 4. OPTIMISTIC-UI / PERF notes (for this area)

- **Inbox open**: served from `MessagesProvider` + `sessionStorage` snapshot ->
  first paint is effectively instant; a background `getMyConversations` reconciles.
  Removing the duplicate inbox derivation on the thread page (Step 0.2) is the single
  biggest server-side win.
- **Send**: optimistic temp bubble + input cleared synchronously (Step 1.3). Target:
  bubble visible < 16ms after Enter, independent of network. `router.refresh()`
  removed so we stop re-rendering the whole server page on every keystroke-send.
- **Navigation between chats**: `<Link prefetch>` + persistent provider = client
  transition, only the right pane swaps. No full reload (problem K fixed).
- **Realtime**: keep the existing channels; add `client_id` reconciliation so the
  echo finalizes the temp instead of appending a duplicate. Drop the per-message
  profile fetch for own messages (Step 3.3).
- **Scroll**: instant jump on open (`useLayoutEffect`, `behavior:"auto"`); guarded
  auto-scroll on new messages; "new messages" pill (Step 3.1).
- **Reduced motion**: already wired (`useReducedMotion`); all new motion must check
  it.
- **Caching**: keep `dynamic = "force-dynamic"` ONLY where auth-correctness needs it,
  but the client provider means freshness no longer depends on the server cache.

## 5. HONESTY + CONTRAST notes

- No mock/fake data in messaging - the system is real end to end. The only
  "placeholder" strings (`"Wants to connect"`, `"Photo"`) are honest fallbacks;
  render "Photo" with an image glyph so it reads as media, not literal copy.
- Contrast fixes (must do):
  - `MessageThread.tsx:242` own-bubble timestamp `text-cream/70` -> `text-cream/90`.
  - `MessageThread.tsx:247` "· Seen" -> full `text-cream` (currently inherits /70).
  - New "sending"/"failed" states must use high-contrast tokens (`ember` on
    `cream`, never faint cream-on-saffron).
- Kill the duplicate/divergent rail (problem J) - the thread-page rail is a worse,
  search-less, full-reload copy; consolidating it is both a UX and an honesty win
  (one real component, not two that drift).
- The realtime publication comment references a `NotificationsList` that does not
  exist (`0022_...:3`) - out of scope here but note it so it is not mistaken for a
  live feature; messaging's own realtime IS live and working.
- No em dashes, no Hindi-only text introduced. Company facts unaffected by this area.

## 6. OPEN QUESTIONS for the founder

1. **Read receipts default**: `markRead` only stamps `read_at` (the "Seen" the
   sender sees) when the reader has `privacy.read_receipts === true`, default OFF
   (`lib/db/messages.ts:893-903`). Confirm "Seen" should stay opt-in (privacy-first,
   like Instagram) vs always-on (like default iMessage).
2. **Rail relevance sort**: pure recency (today) or recency + a network-closeness
   tie-breaker reusing the follow/connection graph (extends the matching engine to
   the inbox)? Recency-only is the safe default; the network tie-break is the
   "world-class" extra.
3. **History depth**: load 50 at a time with "Load earlier" (proposed) - acceptable,
   or do you want infinite auto-scroll-up? Any retention cap on very old threads?
4. **Message edit/delete/react/reply**: none exist today. In scope for this overhaul
   or a later pass? (Each needs schema + RLS work; reactions especially are a known
   "world-class DM" feature.)
5. **Typing/presence persistence**: typing is broadcast-only (ephemeral). Do you want
   true online/last-seen presence (Supabase Presence) on the header, or keep
   typing-only?
6. **Group management**: add/remove members, rename, leave group - not built. Wanted
   in this pass?
7. **Nav unread badge**: today the nav badge is notifications-only. OK to add a
   SEPARATE messages unread count on the Messages nav item (LinkedIn-style), or fold
   DMs into the single bell badge?

---

### File touch summary
- New: `app/(app)/messages/layout.tsx`, `components/messages/MessagesProvider.tsx`,
  `components/messages/ConversationRail.tsx`,
  `components/messages/useThreadMessages.ts`,
  `supabase/migrations/00XX_message_client_id.sql`.
- Edit: `app/(app)/messages/page.tsx` (use provider/rail),
  `app/(app)/messages/[chatId]/page.tsx` (drop inbox re-fetch, use rail, pass `me`),
  `components/composite/MessageThread.tsx` (optimistic merge, scroll, pagination,
  own-echo profile, image, contrast), `components/composite/MessageComposer.tsx`
  (optimistic send + clientId, remove router.refresh), `components/composite/ChatMenu.tsx`
  (optimistic block via context), `components/composite/AcceptRequestButton.tsx` /
  `DeclineRequestButton.tsx` (optimistic move/remove),
  `components/composite/MessagesShell.tsx` (thin wrapper),
  `lib/db/messages.ts` (`client_id` on insert, keyset pagination,
  `getMessageUnreadCount`), `app/(app)/messages/actions.ts`
  (`loadEarlierAction`, pass `clientId`), `lib/supabase/types.ts` (`client_id`),
  `app/(app)/layout.tsx` + `components/layout/AppShell.tsx` (messages unread badge).
- Keep untouched: all of `computeIsRequest` / permission matrix, `sendMessage` core
  rules, moderation, rate limit, notifications, group create, block/mute/accept/
  decline server logic, realtime publication migration.
