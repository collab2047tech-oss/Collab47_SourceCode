# Teardown 04 - Network, Messages, Notifications

Read-only design-engineering audit. Scope: the Network graph UI, the full Messaging
surface (rail / thread / composer / requests / groups), and Notifications, plus the
`lib/db` data layer that feeds their UI states. No source files were modified.

Design tokens: **clean across the whole slice** - a hex scan of all 26 files found
zero hardcoded colors; every color is a defined token (`ink cream paper saffron
saffron-dk ash bone moss ember navy brand gold`) or an opacity modifier on one. Token
violations are therefore omitted per component (there are none).

---

## NetworkPage (`app/(app)/network/page.tsx`)
- **Purpose:** Server page: hero count, incoming invitations, tabbed network grid, two honest "suggested" clusters.
- **Defects:**
  - No `error.tsx`/try-catch around the six parallel `Promise.all` fetches (`page.tsx:16-24`); any one rejection blanks the whole page to the route error boundary with no scoped recovery.
  - `findFromCollegeHref` points at `#college-cluster` (`page.tsx:49-50`) which only exists when `collegeMatches.length > 0`; the same condition gates the button target, so it is consistent - but the "Find from college" CTA is always visible even when it silently falls back to `/explore`, so its label over-promises for users with no college set.
- **Missing states:** No loading state for the route (no `network/loading.tsx`; compare `/messages` which has one) - RUNTIME-CHECK the navigation feels blank until the server render resolves. No error state.
- **A11y:** Hero CTAs are real links/buttons with text; fine.
- **Verdict:** POLISH
- **Planned fix:**
  - Add `network/loading.tsx` skeleton mirroring the grid.
  - Wrap the data fetch so a single failure degrades one section, not the page.
  - Hide/relabel "Find from college" when `profile.college` is null.

## NetworkTabs (`components/composite/NetworkTabs.tsx`)
- **Purpose:** Client island: Connections / Followers / Following / Pending-sent tabs over a `PersonCard` grid.
- **Defects:**
  - Tab badges show **total** counts (`t.data.length`, `NetworkTabs.tsx:94`), not unread/actionable counts. Honest as a total, but the "Pending sent" badge reads like an action item when it is just a size.
  - `stateFor` (`:51-69`) derives relationship from tab + `relStates`; the "pending" tab hardcodes `{pending:true}` which is correct for outgoing, but see PersonCard for the incoming-request hazard when `relStates[id].pending` is surfaced on Followers/Following.
- **Missing states:** Per-tab empty copy present (`:44-49`); good. No error state (parent owns fetch).
- **A11y:** Tab buttons lack `role="tab"`/`aria-selected`/`aria-controls` - they are plain buttons, so screen readers do not announce them as a tab set (`:76-97`). Active tab is only conveyed visually (border + color).
- **Verdict:** POLISH
- **Planned fix:**
  - Add `role="tablist"`/`role="tab"`/`aria-selected` semantics.
  - Consider labeling the Pending badge distinctly (it is not an inbox).

## PersonCard (`components/composite/PersonCard.tsx`)
- **Purpose:** The follow + connect + message card (grid & row variants) with optimistic state.
- **Defects:**
  - **Received-request hazard (worst in Network):** `handleConnect` treats `conn === "pending"` as an *outgoing* request and cancels it via `cancelConnectionAction` (`:69-76`). But `state.pending` can come from `getRelationshipStates`, which does **not** encode direction (`social.ts:557-561` marks any non-accepted row as `pending`). So an **incoming** invite surfaced on a Followers/Suggested card renders as "Pending" and clicking it **deletes the other person's request to you** instead of accepting it. A received invite can be silently destroyed.
  - Optimistic state is seeded once via `useState(state...)` initializers (`:48-53`); later `state` prop changes are ignored. Safe on this server-rendered page (state is resolved before paint) but a latent bug for any client re-feed.
  - `handleMessage` on failure routes to `/u/${handle}` (`:92`) with no toast - the user asked to message and lands on a profile with no explanation of why the DM could not open.
- **Missing states:** Follow/Connect have pending (`disabled={...Pending}`) but no failure surface - a failed toggle silently rolls back (`:63, :82`) with no message.
- **A11y:** Icon-only Message button has `aria-label` (`:189, :233`); pending Connect has `aria-label="Cancel connection request"` (`:134`); follow uses `aria-pressed` (`:104`). Good. Tap targets: `size="sm"` buttons - RUNTIME-CHECK the primitive's height clears 44px (visually ~32-36px, likely under).
- **Verdict:** POLISH
- **Planned fix:**
  - Distinguish incoming vs outgoing pending: pass direction from `getRelationshipStates` (add `pendingIncoming`/`pendingOutgoing`) and render Accept/Ignore, not a destructive "Pending", for incoming.
  - Surface a toast on follow/connect/message failure instead of silent rollback.
  - Re-sync optimistic state from props via `useEffect` if this card is ever used on a client-refreshed surface.

## ConnectionRequests (`components/composite/ConnectionRequests.tsx`)
- **Purpose:** Incoming-invite list with optimistic Accept / Ignore, per-row busy tracking.
- **Defects:**
  - On a failed accept/reject the row is restored (`clearResolved`, `:48, :58`) but **no error is shown** - the card silently re-appears with no reason, reading as a UI glitch.
  - "Ignore" calls `cancelConnectionAction` (`:57`) = hard delete of the connection row; there is no undo and the copy ("Ignore") understates that it permanently discards the request.
- **Missing states:** Loading n/a (parent server-fetched); empty state present (`:65-71`); **error state absent**.
- **A11y:** Accept/Ignore have descriptive `aria-label`s including the person's name (`:104, :114`). Good. Buttons are `size="sm"` (tap target RUNTIME-CHECK).
- **Verdict:** POLISH
- **Planned fix:**
  - Show an inline error + keep the row when accept/reject fails.
  - Consider a short undo window for Ignore, or relabel to "Decline".

## AcceptRequestButton (`components/composite/AcceptRequestButton.tsx`)
- **Purpose:** Optimistically move a message request into the inbox, then confirm server-side.
- **Defects:**
  - **No rollback.** `moveRequestToInbox` runs immediately; on `!r.ok` the code comment explicitly declines to roll back (`:22-27`), so a failed accept leaves the conversation wrongly in the inbox until a full reload - and no error is surfaced. This is optimistic UI that lies on failure.
- **Missing states:** Pending label present ("Accepting...", `:40`); **failure state absent**.
- **A11y:** Text button; fine. Tap target `px-3 py-1.5 text-xs` ~28px tall - **under 44px**.
- **Verdict:** POLISH
- **Planned fix:**
  - Snapshot the request row (as DeclineRequestButton does) and restore + show an error on failure.
  - Bump padding to clear a 44px target.

## DeclineRequestButton (`components/composite/DeclineRequestButton.tsx`)
- **Purpose:** Optimistically remove a request; restore on failure.
- **Defects:** Clean - this is the reference pattern: it snapshots the row and calls `restoreConversation` on `!r.ok` (`:29-41`). Only nit: a failed decline restores silently with no error toast.
- **A11y:** Text button; `disabled` handled. Tap target `px-3 py-2` ~32px - slightly under 44px.
- **Verdict:** KEEP
- **Planned fix:** Optional: add a failure toast; nudge padding to 44px.

## SuggestedFollowRow (`components/composite/SuggestedFollowRow.tsx`)
- **Purpose:** Compact home-rail follow toggle, optimistic with rollback.
- **Defects:** Clean. Optimistic flip + rollback on `!res.ok` (`:38-41`); real server action.
- **A11y:** `aria-pressed` + name-bearing `aria-label` (`:59-60`). Toggle `px-2.5 py-1` tap target under 44px.
- **Verdict:** KEEP

## messages/page.tsx + layout.tsx + loading.tsx (`app/(app)/messages/`)
- **Purpose:** Two-pane shell; layout is a pass-through (provider now lives app-wide); loading skeleton.
- **Defects:** Clean. `loading.tsx` is a genuine rail+thread skeleton. Layout correctly documents that seeding moved to `app/(app)/layout.tsx`.
- **Verdict:** KEEP

## ChatPage (`app/(app)/messages/[chatId]/page.tsx`)
- **Purpose:** Server thread page: header, request banner, thread, composer; computes `canCompose` + reason.
- **Defects:**
  - `canCompose = isGroup || !header.blocked` (`:57`) and `cannotComposeReason` (`:59-61`) are the honest permission surface - good (see Q6). Minor: for an *empty* thread that will route to Requests, nothing warns the sender up front that the first message becomes a request (only a post-send hint from the composer).
  - `currentUserId ?? ""` is threaded into ThreadProvider/MessageThread (`:74-75, :140`); an empty string means "no own messages" which is benign, but if auth is momentarily null every bubble renders as not-own (left-aligned). RUNTIME-CHECK auth is always resolved here (it is a force-dynamic authed route, so fine).
- **Missing states:** No thread-load error state (relies on `getConversationMessages` returning `[]`, which is indistinguishable from a genuinely empty thread - a fetch error shows "No messages yet. Start the conversation." which is misleading).
- **A11y:** Back arrow has `aria-label` (`:84`); header is semantic. Good.
- **Verdict:** POLISH
- **Planned fix:**
  - Distinguish load-failure from empty-thread (return a discriminated result or throw to an error boundary).
  - Optional: pre-send hint when the thread will land in Requests.

## messages/requests/page.tsx (`app/(app)/messages/requests/`)
- **Purpose:** Renders `RequestsList` from the shared provider.
- **Defects:** Clean.
- **Verdict:** KEEP

## ConversationRail (`components/messages/ConversationRail.tsx`)
- **Purpose:** The single shared rail (index + every thread): inbox/requests sub-tabs, search, rows, New-group entry.
- **Defects:**
  - `relativeTime` is computed at render with **no re-tick** (`:17-27`); "now/5m/2h" go stale until an unrelated re-render. NotificationsList solved this with a 60s interval; the rail did not.
  - Inbox tab shows `conversations.length` (total, `:143`), Requests shows `requests.length` (total, `:164`). Neither is an unread count - the saffron Requests pill reads like "N unread requests" but is really "N request threads". Honest-ish, potentially misread.
  - Group rows always render the `Users` glyph, so the `avatarUrl` derived server-side for groups is dead data (see MessagesProvider / messages.ts note) - harmless.
- **Missing states:** Empty states for both search-empty and tab-empty present (`:185-196`). No error state (provider-backed, seeded server-side).
- **A11y:** Rows are `<Link>` with `aria-current` (`:49`). Search input has a placeholder but **no label / aria-label** (`:175-180`). New-group button has visible text. Sub-tab buttons lack `role="tab"` semantics.
- **Verdict:** POLISH
- **Planned fix:**
  - Add a shared 60s clock (or lift NotificationsList's pattern) so timestamps tick.
  - Label the search input; add tab semantics.
  - Clarify the Requests badge is a count of threads, or make it an unread count.

## MessagesProvider (`components/messages/MessagesProvider.tsx`)
- **Purpose:** App-wide DM cache: seed, reconcile, optimistic mutations, ONE realtime rail subscription, live unread count.
- **Defects:**
  - The rail channel subscribes to **every** `messages` INSERT with no server-side filter and filters client-side by `idSet` (`:267-296`). Functionally correct, but it depends entirely on realtime RLS to avoid leaking other users' message previews to the client. RUNTIME-CHECK the `messages` realtime publication is RLS-scoped to members; if not, this is a privacy leak and a scale problem (every client wakes on every message in the system).
  - Only INSERT is handled. A conversation **deleted** elsewhere (a peer declines your request) is not reflected via realtime - only via optimistic local removal or a hard re-seed (`:224-229` is local-only). No DELETE/UPDATE(read_at cross-tab) subscription on the rail.
  - `unreadCount` counts only main `conversations` (`:304-307`), correctly excluding requests. Good.
- **Missing states:** n/a (state container). `mergeServerList` (`:104-124`) is a careful reconciliation that preserves fresher local edits - solid.
- **A11y:** n/a.
- **Verdict:** POLISH
- **Planned fix:**
  - Confirm/enforce RLS on the `messages` realtime publication; if broad, narrow the subscription or move rail updates behind an authorized channel.
  - Subscribe to relevant DELETE (and cross-tab read UPDATE) so the rail self-heals without a reload.

## RequestsList (`components/messages/RequestsList.tsx`)
- **Purpose:** Requests view: shared rail + animated request rows with Accept/Decline/View.
- **Defects:** `relativeTime` again has no re-tick (`:13-21`). Inherits AcceptRequestButton's no-rollback failure.
- **Missing states:** Empty state present (`:60-67`); no error state (provider-backed).
- **A11y:** Rows use motion divs with Links/buttons inside; Accept/Decline/View reachable. Fine.
- **Verdict:** POLISH
- **Planned fix:** Shared ticking clock; inherit AcceptRequestButton rollback fix.

## ThreadProvider (`components/messages/ThreadProvider.tsx`)
- **Purpose:** Per-thread state: optimistic temps, realtime INSERT/UPDATE reconciliation by `client_id`, load-earlier, mark-read, `lastSeenOwnId`.
- **Defects:**
  - `failOptimistic(clientId, reason?)` accepts a `reason` but **ignores it** (`:168-177`) - it only sets `status:"failed"`. The failure reason the composer passes is dropped on the floor, so the bubble can never explain itself (root of the composer's opaque-failure defect).
  - Optimistic temps live only in memory. A `temp:` bubble (sending or failed) that has not been confirmed is **never persisted**; navigating away and back re-seeds from the server (`:98-120`) which has no temp, so an un-sent/failed message **silently vanishes** with no record.
  - `lastSeenOwnId` (`:311-317`) is derived from real `read_at` - honest; it is null unless the reader has read receipts on (see messages.ts `markRead`). Correct, not fake.
- **Missing states:** load-earlier loading + hasMore handled (`:179-201`); a failed `loadEarlierAction` returns `[]` and is treated as "no more" (`:194-197`) - a transient load error looks like end-of-history.
- **A11y:** n/a (state container).
- **Verdict:** POLISH
- **Planned fix:**
  - Store the failure reason on the temp and render it near the bubble.
  - Persist unsent/failed temps (e.g. sessionStorage keyed by conversation) so they survive navigation, or block navigation with unsent drafts.
  - Distinguish load-earlier error from end-of-history.

## MessageComposer (`components/composite/MessageComposer.tsx`)
- **Purpose:** Optimistic send (text + image), typing broadcast, retry, blocked footer.
- **Defects (this file holds the two worst messaging bugs):**
  - **Stuck "Sending" forever.** `runSend` wraps only the image upload in try/catch; the `sendMessageAction(fd)` call itself is not guarded (`:141`), and `handleSubmit` fires it as `void runSend(...)` (`:187`). If the action rejects (network drop, server exception), the promise rejection is unhandled, `failOptimistic` is never called, and the bubble spins on "Sending" permanently with no retry path. A dropped send looks in-flight forever - **message effectively lost behind a live spinner.**
  - **Opaque failure.** On `!result.ok`, `errorNote` is set **only** when `result.blockedReason` exists (`:156-161`). Rate-limit (`RATE_LIMITED`), moderation ("Content blocked by policy"), and generic ("Failed to send message") errors produce a "Not delivered - Retry" bubble with **no stated reason**, and retry re-fails identically (these are deterministic). The user has no idea why and no path forward.
  - Typing broadcast fires 800ms **after** the last keystroke (`TYPING_DEBOUNCE_MS`, `:22, :77-78`) - i.e. it signals "paused typing", not "is typing"; the peer then shows dots for 2s. Backed by a real broadcast (not fake), but the timing is inverted vs the usual "emit on start, debounce the stop".
- **Missing states:** pending (temp bubble) yes; success (confirm) yes; failure surface incomplete (above). Blocked footer honest (`:205-215`).
- **A11y:** Attach + Send buttons have `aria-label` (`:264, :291`); the file-name remove has `aria-label` (`:249) but the **image-preview remove X (`:230-237`) has no `aria-label`**. Send/attach buttons are `size-9` (36px) - **under 44px**.
- **Token violations:** none (`text-ember` for errors is a defined token).
- **Verdict:** POLISH (architecture is sound; fixes are targeted but high-priority)
- **Planned fix:**
  - Wrap the `sendMessageAction` call in try/catch and call `failOptimistic` on throw so a dropped send becomes retryable instead of stuck.
  - Show `errorNote` for every non-ok result (rate-limit / moderation / generic), and render the stored reason on the bubble; suppress "Retry" for permanent failures (block/moderation).
  - Emit typing on first keystroke, debounce the stop.
  - Add `aria-label` to the preview remove; enlarge tap targets to 44px.

## MessageThread (`components/composite/MessageThread.tsx`)
- **Purpose:** Message list: date grouping, own/other bubbles, sending/failed/Seen, typing dots, new-message pill, load-earlier, scroll management.
- **Defects:**
  - "Seen" (`:243-247`) keys off `msg.id === lastSeenOwnId` which is `read_at`-backed and privacy-gated - **honest**, will not falsely claim a read.
  - "Not delivered - Retry" (`RetryFailed`, `:298-315`) dispatches a window `CustomEvent` the composer listens for; works only while the composer is mounted in the same view (it is) - but couples two components via a global event, and a retry after the composer unmounts (e.g. blocked footer swap) is a no-op.
  - Typing dots (`:263-271`) are driven by the real broadcast channel - not fake.
- **Missing states:** empty ("No messages yet", `:166-171`) - but as noted this also shows on a fetch error; load-earlier loading (`:156-161`) present; no per-message error text (reason dropped upstream).
- **A11y:** RetryFailed has `aria-label` (`:307`); new-message pill is a button with text; images have alt text. Load-earlier is a real button. Good.
- **Verdict:** POLISH
- **Planned fix:** Render failure reason on the bubble; make empty-vs-error distinct; consider owning retry in the provider rather than via window events.

## MessagesShell (`components/composite/MessagesShell.tsx`)
- **Purpose:** Index two-pane wrapper: rail + empty right-pane placeholder.
- **Defects:** Clean.
- **Verdict:** KEEP

## ChatMenu (`components/composite/ChatMenu.tsx`)
- **Purpose:** Mute/unmute + block/unblock, optimistic with rollback, seeds composer blocked footer.
- **Defects:**
  - All three actions roll back on failure (`:52-84`) - good - but none surface an error on rollback (silent).
  - Menu is a custom popover: closes on outside mousedown (`:38-45`) but **not on Escape**, and does not trap focus.
- **Missing states:** pending via `disabled={isPending}` on the trigger only (`:91`); menu items have no per-item pending. Failure = silent rollback.
- **A11y:** Trigger has `aria-label` (`:91`) and is `size-10` (40px, marginal). Popover lacks `role="menu"`/`aria-expanded` on the trigger and no Esc handling.
- **Verdict:** POLISH
- **Planned fix:** Add `aria-expanded`/`role="menu"`, Escape-to-close, focus return; toast on failed block/mute.

## NewGroupModal (`components/composite/NewGroupModal.tsx`)
- **Purpose:** Create a group chat: load connections, name + multi-select, create, navigate.
- **Defects (Q5 - it is NOT a stub, group chat is real end-to-end):**
  - Group chat is genuinely wired: create (`createGroupConversation` via admin, `messages.ts:449-492`) -> header branch (`getConversationHeader` group path, `messages.ts:259-273`) -> send bypasses the 1:1 gate (`sendMessage` `isGroup`, `messages.ts:714-740`) -> thread renders per-sender avatars -> rail shows the group with a `Users` glyph. So the modal is a working feature, not a placeholder.
  - **Gaps (missing features, not stubs):** no add/remove members after creation, no leave-group, no rename, no member list view (only "N members"), no group avatar. Post-creation group management does not exist anywhere in the slice.
  - Candidate load has **no error branch**: `getGroupCandidatesAction().then().finally()` (`:34-37`) has no `.catch`; a failed load ends with `loading=false` and empty candidates, which renders "Connect with people to start a group." (`:143-146`) - **misleading**: it tells a user with connections that they have none when the fetch actually failed.
- **Missing states:** loading (`:136-138`) and empty (`:139-148`) present; create error present (`:182`); **candidate-load error absent**.
- **A11y:** Close button has `aria-label` (`:104`); candidate rows are buttons. **No `role="dialog"`/`aria-modal`, no focus trap, no Escape-to-close** (only backdrop mousedown + the X). Modal is not keyboard-dismissible.
- **Verdict:** POLISH
- **Planned fix:**
  - Add `.catch` -> distinct error state for candidate load.
  - Add dialog semantics, focus trap, Escape close.
  - (Roadmap, out of slice) group management: add/remove/leave/rename.

## notifications/page.tsx (`app/(app)/notifications/`)
- **Purpose:** Server-fetch last 50 notifications, hand to the client list.
- **Defects:** Clean. Passes raw ISO timestamps through for client-locale formatting (`:33-35`) - fixes the historical UTC bug. Falls back gracefully when `sb`/user absent.
- **Verdict:** KEEP

## NotificationItem (`components/composite/NotificationItem.tsx`)
- **Purpose:** One clickable notification row; marks read on plain click, routes on click, local time.
- **Defects:** Clean. Modifier/middle-clicks fall through so open-in-new-tab works (`:44-53`); leading actor name is bolded without duplication (`:57-58`); `<time>` carries `dateTime` + absolute `title` (`:88-94`).
- **A11y:** Real `<a>` (keyboard + new-tab friendly); time is semantic.
- **Verdict:** KEEP

## NotificationsList (`components/composite/NotificationsList.tsx`)
- **Purpose:** Client list: optimistic mark-read/all, realtime INSERT/UPDATE, day-bucketed New/Earlier sections, 60s ticking clock.
- **Defects:**
  - `markRead`/`markAll` are optimistic but **do not roll back** if the server action fails (`:70-84`); the actions are best-effort `void`, so a failure leaves rows read locally but unread server-side until the next load re-seeds. Low impact (self-heals on reload), but technically inconsistent optimism.
  - Realtime handled for INSERT + UPDATE with a `seen` de-dupe set (`:88-132`) - solid.
- **Missing states:** empty state present (`:161-170`); no explicit error/loading (server-rendered first paint + realtime top-up). Unread count is real (`:134-137`).
- **A11y:** Section headings are `<h2>`; rows via NotificationItem. Fine.
- **Verdict:** POLISH (minor)
- **Planned fix:** Roll back optimistic read state if the action reports failure (or make the actions return a result and honor it).

## MarkAllReadButton (`components/composite/MarkAllReadButton.tsx`)
- **Purpose:** Delegates the optimistic mark-all to the parent; reflects "done" locally.
- **Defects:** Clean. Disabled when no unread or already done (`:22-27`).
- **A11y:** Text button with responsive label; disabled state handled.
- **Verdict:** KEEP

## NotificationBell (`components/layout/NotificationBell.tsx`)
- **Purpose:** Live top-bar unread badge: seed from server count, realtime INSERT (+1) / UPDATE-read (-1).
- **Defects:**
  - Decrement only fires for rows whose id is in `seenUnread` - i.e. rows this bell counted via an INSERT **this session** (`:63-80`). A notification read on **another tab/device** that the bell never saw inserted will not decrement; the count can overstate until the next navigation re-seeds `initialCount` (`:30-32`). Bounded and self-healing, but a transient real-count inaccuracy.
- **Missing states:** n/a (badge only). Count is real (`getUnreadCount`, `notifications.ts:18-33`).
- **A11y:** `aria-label="Notifications"` on the link (`:93`). Badge is decorative text inside the labeled link. Tap target `p-2.5` + `size-4` ~36px - under 44px.
- **Verdict:** POLISH (minor)
- **Planned fix:** On UPDATE-to-read for an unknown id, re-fetch the authoritative count (or decrement optimistically with a floor) so cross-device reads reconcile without a nav.

## lib/db/social.ts
- **Purpose:** Follow/connect graph, pending split, suggestions, relationship states, search, trending.
- **Defects:** Data layer is sound and honest (real upserts with `.select()` to notify only on genuinely new rows; `getPendingConnections` splits incoming/outgoing by `requested_by`; `acceptConnection` has defense-in-depth `neq requested_by` + status guard). **One UI-facing gap:** `getRelationshipStates` collapses both pending directions into a single `pending` boolean (`:557-561`), which is what lets an incoming request masquerade as a cancelable "Pending" on PersonCard (see PersonCard defect #1).
- **Verdict:** KEEP (add directional pending to close the PersonCard hazard)

## lib/db/messages.ts
- **Purpose:** Conversations, messages, permission matrix (`computeIsRequest`), send, accept/decline, mark-read, block/mute, unread RPC.
- **Defects:**
  - The DM permission matrix (`computeIsRequest`, `:494-595`) is thorough and returns human `reason` strings for every block path (blocked / "not accepting new messages" / "only accepts from network" / "applicants cannot message authors first"). These flow to `blockedReason` -> the composer footer/error, so the UI **does** explain why (Q6 answered: not opaque at the DB-gate level).
  - `getConversationMessages` returns `[]` both for empty threads and on failure (`:202-206`) - the UI cannot tell them apart (drives the misleading "No messages yet" on error).
  - `markRead` honors the reader's `read_receipts` privacy flag before stamping `read_at` (`:945-962`) - this is why "Seen" is honest and privacy-respecting.
  - `sendMessage` handles `client_id` idempotency on unique-violation (`:756-770`) - good; prevents duplicate rows on retry.
- **Verdict:** KEEP (consider a discriminated result for load errors)

## lib/db/notifications.ts
- **Purpose:** Unread count, mark read/all, coalesced create + push, actor lookup.
- **Defects:** Clean. Create coalesces duplicates within 10 min (`:88-108`) and pushes only for high-value kinds (`:7-15`). All best-effort, never throws to the caller.
- **Verdict:** KEEP

---

## Cross-cutting

**Q1 - Connect state machine (visible to user?):** Mostly yes. `none -> pending -> connected` is fully rendered on PersonCard (Connect / Pending / Connected), and **sent vs received are distinguished at the page level** - incoming render in `ConnectionRequests` (Accept/Ignore, split via `requested_by`), outgoing in the "Pending sent" tab. **The gap:** on Followers/Following/Suggested cards the direction is lost (`getRelationshipStates.pending` is undirected), so a *received* invite there shows as a cancelable "Pending" whose click **deletes** it. Fix by threading direction into the state.

**Q2 - Message send failure:** Optimistic, retryable, and the payload is kept for retry within the session - but three real holes: (1) a thrown action leaves the bubble **stuck on "Sending" forever** (no try/catch around `sendMessageAction`); (2) non-block failures (rate-limit, moderation, generic) fail **opaquely** with no reason and a retry that re-fails; (3) a failed/unsent temp is **lost on navigation** (never persisted). The message is not lost on an ordinary `ok:false` (retry works), but it is effectively lost in cases (1) and (3).

**Q3 - Unread badges (real or approximated?):** **Real.** Rail dot = `last_read_at` vs message `created_at` (`getMyConversations`), live via realtime `bumpToTop`. Nav DM badge = provider `unreadCount` (live) with a server first-paint fallback; server count from the `unread_message_count()` RPC. Notification bell + list = `read_at`-derived, live via realtime. No approximations. Minor: rail tab pills show total thread counts, not unread; the bell's cross-device decrement can transiently overcount.

**Q4 - Realtime vs poll vs static:** **All realtime, nothing polls.** Rail = one app-level `postgres_changes` INSERT subscription (MessagesProvider). Thread = per-conversation INSERT + UPDATE. Notifications list + bell = INSERT + UPDATE. Typing = broadcast channel. Watch items: the rail subscribes to *all* message INSERTs and filters client-side (RUNTIME-CHECK realtime RLS actually scopes rows to members - otherwise a preview leak); rail/RequestsList timestamps do not re-tick (only NotificationsList does); rail has no DELETE/read-UPDATE subscription so declined/blocked threads self-heal only on re-seed.

**Q5 - NewGroupModal / group chat (stub?):** **Not a stub - group chat is implemented end-to-end** (create -> header -> send-bypass -> thread render -> rail). What is genuinely missing is *post-creation management*: no add/remove members, leave, rename, member list, or group avatar. Also the candidate loader has no error branch, so a failed fetch masquerades as "you have no connections."

**Q6 - DM permission matrix (does the UI say WHY?):** **Yes, at the gate.** `computeIsRequest` returns a specific `reason` for every block path, surfaced two ways: the composer's disabled footer (`cannotComposeReason` from `getConversationHeader`, resolved server-side) and, on a live send, `errorNote = "Cannot send: <reason>"`. So blocks/permission-denials are explained, not opaque. The opacity is elsewhere: **non-permission** failures (rate-limit, moderation, network) fail with no reason (Q2 defect #2), and a stranger's message silently routing to Requests is only explained *after* sending (post-hoc hint).

### Dishonest-UI findings
No **fabricated** signals were found. The three "live" indicators are all backed by real events:
- **Typing dots** - driven by a real Supabase broadcast from the peer's composer (timing is inverted - emits on pause, not on start - but it is real).
- **"Seen"** - keyed off real `read_at`, and only stamped when the *reader* has read receipts enabled (default off), so it never lies.
- **"Sending" / "Not delivered - Retry"** - reflect real send status.

Two **misleading (not fabricated)** states worth flagging:
1. **Permanent "Sending" spinner** when a send throws (MessageComposer runSend has no catch around the action) - presents an in-flight state that never resolves. Bug, not fabrication, but it deceives the user into thinking a lost message is still sending.
2. **"Retry" offered on a permanently-blocked / moderation-rejected message** - an action that can never succeed, with no reason shown.

### Highest-value cross-cutting fixes
1. Guard `sendMessageAction` with try/catch so dropped sends become failed+retryable, not eternal spinners (MessageComposer `:141/:187`).
2. Surface a reason for every non-ok send and stop dropping `failOptimistic`'s reason arg (MessageComposer `:156-161`, ThreadProvider `:168-177`).
3. Encode pending **direction** through `getRelationshipStates` so a received invite can never be cancel-deleted from a person card (social.ts `:557-561`, PersonCard `:69-76`).
4. Give AcceptRequestButton a rollback + error path to match DeclineRequestButton.
5. Add dialog semantics/focus-trap/Escape to NewGroupModal and ChatMenu; enlarge sub-44px tap targets (composer, accept/decline, follow toggles, bell).
6. Add a shared ticking clock to the rail/RequestsList; distinguish thread load-errors from genuinely-empty threads.

### Verdict tally (28 files graded)
- **KEEP (12):** SuggestedFollowRow, DeclineRequestButton, messages/page+layout+loading, messages/[chatId]/loading, messages/requests/page, MessagesShell, notifications/page, NotificationItem, MarkAllReadButton, social.ts, messages.ts, notifications.ts. (network/actions, messages/actions, notifications/actions are also clean - KEEP.)
- **POLISH (16):** NetworkPage, NetworkTabs, PersonCard, ConnectionRequests, AcceptRequestButton, ChatPage, ConversationRail, MessagesProvider, RequestsList, ThreadProvider, MessageComposer, MessageThread, ChatMenu, NewGroupModal, NotificationsList, NotificationBell.
- **REBUILD (0):** none - the architecture is sound throughout; every issue is a targeted fix, not a teardown.
