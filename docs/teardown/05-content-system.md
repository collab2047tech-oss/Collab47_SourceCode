# Teardown 05 - Content System (News, Events, Explore/Search, Settings, Analytics, Admin, App Chrome, Primitives, Motion)

READ-ONLY design-engineering audit. Scope: news + tags, events, explore/search, settings, analytics, admin, `AppShell`, primitives, motion, brand, manifest/OG. No source files were edited.

Token legend (locked): ink `#12100E`, cream `#FBF8F4`, paper `#FFF`, saffron `#B95402` (actions), brand `#D76202` (logo/art only), moss `#106434`, navy `#03265E`, ember `#B91C1C`, ash `#6B6559`, bone `#E7E0D6`. `globals.css` also defines two non-locked but real CSS tokens used widely: `saffron-dk #A34802` (hover) and `gold #B45309` (highlight). Using those is token-based (allowed); hardcoded hex and non-token Tailwind colors are violations.

---

## /news list (`app/(content)/news/page.tsx`)
- **Purpose:** Server component; fetches viewer-ranked news (300) + pre-resolves saved ids, renders `InShortsFeed`.
- **Defects:** none of substance. Clean, honest data path (`getRankedNewsForUser`).
- **Missing states:** No `app/(content)/news/loading.tsx`. Route is `force-dynamic` and awaits a 300-item ranked fetch + a `news_saves` query before first paint; there is no group-level loading in `(content)`, so navigation to /news blocks with a blank screen. Events and (app) both have skeletons; /news does not.
- **A11y:** fine.
- **Token violations:** none.
- **Verdict:** KEEP
- **Planned fix:** Add `app/(content)/news/loading.tsx` (a full-bleed card skeleton mirroring the InShorts layout).

## News reader (`app/(content)/news/[id]/page.tsx`)
- **Purpose:** Full in-app story reader with JSON-LD, the AI "brief", action bar, external link, comments.
- **Defects:** `[id]/page.tsx:95` no-image header uses hardcoded gradient `bg-[linear-gradient(135deg,#12100E_0%,#A34802_100%)]` (ink + saffron-dk hexes hardcoded instead of `var(--color-*)`).
- **Missing states:** `notFound()` handled (`:61`); comments have their own thread. OK.
- **A11y:** `img alt=""` (`:91`) is intentional decorative-with-caption; acceptable. Back link + external link labelled.
- **Token violations:** `:95` hardcoded gradient hex (values match tokens, but hardcoded).
- **Verdict:** KEEP
- **Planned fix:** Replace the arbitrary gradient with token vars (or a shared `.brand-gradient` utility reused by InShortsFeed/EventCard).

## Hashtag page (`app/(content)/t/[tag]/page.tsx`)
- **Purpose:** Posts for a `#tag` with Top/Latest sort, real total from `hashtags.use_count`, related tags, PostCards.
- **Defects:** When `sb` is null (config/connection failure) the page silently renders the empty state ("No posts with #tag yet.") instead of an error state - a connection failure reads as "no content."
- **Missing states:** loading (no `loading.tsx`), error (masked as empty). Empty + content present.
- **A11y:** segmented Top/Latest are real `<Link>`s; fine.
- **Token violations:** none.
- **Verdict:** KEEP
- **Planned fix:** Distinguish "no rows" from "query failed"; add a loading skeleton.

## InShortsFeed (`components/composite/InShortsFeed.tsx`)
- **Purpose:** Full-screen snap-scroll news reader with local re-shuffle personalisation + keyset "load every article" pagination.
- **Defects:**
  - `:118` The fixed shell is hardcoded to the member `AppShell` chrome: `fixed inset-x-0 bottom-16 top-16 ... md:bottom-0 md:left-60`. But `(content)/layout.tsx` serves a DUAL shell - anonymous/logged-out visitors get `PublicTopNav` (h-16) with NO bottom nav and NO left sidebar. For a logged-out visitor (the indexable case this route explicitly targets), on desktop the reader is pushed `left-60` (240px) into empty space, and on mobile it leaves a 64px `bottom-16` gap where no bottom nav exists. Visual break on the exact audience the public shell was built for. (RUNTIME-CHECK, but code-evident.)
  - Silent pagination: `:89-102` fetches older news with no visible "loading more" affordance, and on exhaustion silently re-cycles the set (`:82-86`) with no "you're all caught up" moment. A thrown `loadMoreNewsAction` is swallowed into `exhaustedRef=true` (`:101`) with no error surfaced.
  - `:205-207` un-toggling "More like this" (signal -> null) fires no server call to reverse the durable affinity; only the durable +1 that was already written stays. `aria-pressed` implies a reversible toggle. Minor honesty nit.
- **Missing states:** loading-more indicator absent; "end" state absent (recycles by design); error state absent (silent). Empty state present + good (`:119-128`).
- **A11y:** icon links have `aria-label`/`title` (external, read). Snap container is scrollable. OK.
- **Token violations:** `:163` no-image header hardcoded gradient hex (same as reader).
- **Verdict:** POLISH
- **Planned fix:** (1) Make the fixed offsets shell-aware (a prop/context flag from `(content)/layout` for anon vs member, or render inside normal flow for anon). (2) Add a bottom "loading more" spinner and a terminal "You're all caught up" chip before the recycle kicks in. (3) Surface fetch errors with a retry. (4) Tokenize the gradient.

## NewsActions (`components/composite/NewsActions.tsx`)
- **Purpose:** Save / More / Less / Discuss / Share / Report action bar (compact + full variants), optimistic.
- **Defects:** Share has a robust clipboard + `execCommand` fallback. "Less like this" writes a durable negative signal; fine. Only nit: same toggle-off-doesn't-reverse-server behavior noted above.
- **Missing states:** Save is optimistic with no failure rollback (fire-and-forget `setNewsSavedAction`); a failed save leaves the UI showing "Saved" while the DB has nothing. Low severity (save is idempotent) but not honest on failure.
- **A11y:** every icon button has `aria-label` + `title` + `aria-pressed`; overflow menu has `role=menu`/`menuitem`, `aria-haspopup`, `aria-expanded`, outside-click close. Strong.
- **Token violations:** none (moss/ember/saffron tokens used correctly).
- **Verdict:** KEEP
- **Planned fix:** Roll back the optimistic `saved` flag if `setNewsSavedAction` returns `!ok`.

## NewsRail (`components/composite/NewsRail.tsx`)
- Clean. Loading handled by parent; has empty state + "see all". KEEP.

## News data layer (`lib/news/fetch.ts`, `lib/db/newsEngage.ts`, `app/(content)/news/actions.ts`)
- **Purpose:** Fetch/dedupe/summarise/store news; ranked recall; engagement (save, topic affinity, comments, report).
- **Defects:** `newsEngage.ts` returns `{ ok: true }` when `sb` is null (`setNewsSaved:136`, `reactToNews`, etc.) - a null client reports success. In prod `sb` is configured so this is theoretical, but it means the UI can never learn the DB is down. Summaries are honestly status-tagged (`ai`/`headline`/`raw`/`none`) and trash rows dropped - genuinely honest content pipeline.
- **Missing states:** n/a (data layer).
- **Verdict:** KEEP
- **Planned fix:** Return `{ ok: false }` (or throw) on missing client so the optimistic UIs can surface failure.

---

## Events list (`app/(app)/events/page.tsx`)
- **Purpose:** Kind chips + Upcoming/Past tabs, result count, grid, empty state, "Post an event".
- **Defects:** none material.
- **Missing states:** loading present (`events/loading.tsx`, good skeleton). Empty state is filter-aware (`:145-169`). No error boundary. Content + count states present.
- **A11y:** filter chips/tabs are `<Link>`s (real, shareable URLs). Tap targets ~`py-1.5` chips could be marginal (<44px height) - RUNTIME-CHECK.
- **Token violations:** none.
- **Verdict:** KEEP
- **Planned fix:** Add `aria-current` to the active chip/tab; verify chip tap height >=44px on mobile.

## Event detail (`app/(app)/events/[id]/page.tsx`)
- **Purpose:** Full event view; register CTA, metadata grid, deadline pill, share, author.
- **Defects:** `:241` register anchor uses `href={event.registration_url ?? "#"}` but is only rendered when `hasReg` is true, so the `"#"` fallback is dead-but-safe. Not-found is handled inline (`:80-103`) rather than `notFound()` - acceptable, arguably nicer.
- **Missing states:** not-found present; no loading (covered by `(app)/loading.tsx`). Deadline "Registration closed" state present.
- **A11y:** external register link has icon + text; share button is a component. OK.
- **Token violations:** none.
- **Verdict:** KEEP

## New event (`app/(app)/events/new/page.tsx`) + action (`.../new/actions.ts`)
- Clean thin wrappers over `EventForm` + `createEvent`. KEEP.

## Events question 6 - attend / capacity / past
- **There is NO in-app "attend"/RSVP/going/interested/capacity concept anywhere** (`app/(app)/events`, `EventCard`, `EventForm`, `lib/db/events.ts` all searched - zero hits). Registration is exclusively an external `registration_url` link (or "View details" when absent). No attendee list, no capacity cap, no seat count.
- **Past handling:** real. `listEvents` filter `upcoming` = `registration_deadline >= now OR starts_at >= now`; `past` = `starts_at < now`. `EventCard.deadlineState`/detail `deadlineState` render "Registration closed" once the deadline passes. This is coherent, if minimal. If "attend" is a desired product surface it is simply absent (not broken).

## EventCard (`components/composite/EventCard.tsx`)
- **Purpose:** Grid card with image/gradient header, kind badge, deadline pill, meta, tags, register/details CTA.
- **Defects:** hardcoded off-token colors:
  - `:22` `text-[#9A6A00]` and `:189` `text-[#9A6A00]` - hardcoded hex, NOT a token (differs from `gold #B45309`). Prize/fest text.
  - `:98` gradient `...#03265E_0%,#047857_100%` - `#047857` is emerald-600, off-palette (moss is `#106434`). The other gradient hexes (`#12100E`,`#A34802`,`#B95402`,`#6B6559`) match tokens but are hardcoded.
- **Missing states:** n/a (pure card). Bade fallback via `kindMeta`.
- **A11y:** header `<Link aria-label={event.title}>`; register/details full-width CTAs. Good.
- **Token violations:** `:22`, `:98`, `:189` (see above).
- **Verdict:** POLISH
- **Planned fix:** Replace `#9A6A00` with `text-gold` (or a new prize token); swap `#047857` for `var(--color-moss)`; tokenize the shared gradient set into a util reused by InShortsFeed + news reader.

## EventForm (`components/composite/EventForm.tsx`)
- **Purpose:** Client form; image upload (compress + Supabase storage) or image URL, then `createEventAction`, redirect.
- **Defects:** The native `<select>`, `<textarea>`, and `datetime-local` inputs use bespoke classes with `focus:outline-none` and only a `focus:border-ink` (`selectClass`/`dateClass`/textarea `:167`) - i.e. they REMOVE the browser focus ring and replace it with a low-contrast border change. Same anti-pattern as the `Input` primitive. Also the whole form bypasses a shared field primitive (selects/dates are hand-rolled), so focus/disabled/error behavior drifts from `Input`.
- **Missing states:** pending ("Publishing...") + error present. No success state (redirects, fine). No per-field validation display (server returns one error string).
- **A11y:** labels are wired via `htmlFor`/`id`. Focus indicator weak (see defects). Remove-image button labelled.
- **Token violations:** none (uses ember for error).
- **Verdict:** POLISH
- **Planned fix:** Give selects/dates a `focus-visible` ring matching a fixed primitive; extract a `Select`/`Field` primitive; keep `Input`'s ring consistent.

## Events data (`lib/db/events.ts`)
- Clean: validates title, http(s) URL, tags (lowercased/deduped/cap 8), dates; moderates free text; soft-delete aware. KEEP.

---

## Explore (`app/(app)/explore/page.tsx`)
- **Purpose:** Dual-mode: `?q=` renders `ExploreSearch` with server-seeded results; otherwise a dense discover surface (people, projects, trending, tag cloud, college leaderboard).
- **Defects:** none material. Every section has an empty state; leaderboard uses a real SQL aggregate (`college_leaderboard` RPC) with `CountUp`.
- **Missing states:** covered per-section; loading via `(app)/loading.tsx`.
- **A11y:** section labels; links labelled.
- **Token violations:** none.
- **Verdict:** KEEP

## GlobalSearch (`components/search/GlobalSearch.tsx`)
- **Purpose:** Top-bar combobox: debounced typeahead, client cache, recent + trending empty state, ⌘K, full keyboard nav.
- **Defects:** No minimum query length - a single character fires a server action after 180ms (minor DB chatter; results still fine).
- **Missing states:** loading (`SkeletonRows`), empty/no-results, focused-empty (recent+trending) all present. `isPending && !results` guards the skeleton.
- **A11y:** exemplary - `role=combobox`, `aria-expanded/haspopup/owns/controls/autocomplete`, `role=listbox/option`, `aria-selected` active row, Arrow/Enter/Escape handling, outside-click close, clear button labelled, ⌘K hint. This is the reference implementation for the app.
- **Token violations:** none (a stale `// cobalt-tinted` comment in `SearchResults.tsx:47` describes saffron - cosmetic comment drift only).
- **Verdict:** KEEP
- **Planned fix (optional):** gate queries at length >= 2.

## SearchResults (`components/search/SearchResults.tsx`) + ExploreSearch (`components/composite/ExploreSearch.tsx`)
- **Purpose:** Shared grouped result rows + full-page search box (seeded from URL, same debounce/cache/keyboard model).
- **Defects:** none material. `ExploreSearch` correctly avoids re-fetching the server-seeded query on mount.
- **A11y:** rows are `role=option` with `aria-selected`; keyboard nav via shared `flattenResults`. Good. (ExploreSearch keyboard handler lacks an Enter->"see all" fallback that GlobalSearch has; minor.)
- **Token violations:** none (stale "cobalt" comment only).
- **Verdict:** KEEP

## Search question 4 - summary
Debounce: YES (180ms, both boxes). Loading: YES (skeletons + spinner). Empty results: YES (distinct no-results copy). Keyboard nav: YES (Arrow/Enter/Escape, active-row highlight, ⌘K in the top bar). Plus a 30s server micro-cache and a client cache. This is the strongest surface in the slice.

---

## Settings page (`app/(app)/settings/page.tsx`) + `SettingsView` (`components/composite/SettingsView.tsx`)
- **Purpose:** Account (profile identity + academic), Privacy, Notifications, DM permissions, Language, Billing, sign-out, delete.
- **Control-by-control persistence audit (question 2):**

| Section | Control | Persists? | Path |
|---|---|---|---|
| Account/Profile | Full name | YES (7-day gated) | `updateAccountAction` -> `updateProfile` |
| Account/Profile | Handle | YES (7-day gated, uniqueness) | same |
| Account/Profile | Email | N/A (disabled, read-only) | intentionally not editable |
| Account/Profile | "Change photo" | link to `/profile/edit` | out of scope here |
| Account/Academic | College / Branch / Year | YES | `updateAccountAction` -> `updateProfile` |
| Privacy | Private account | YES (also syncs `is_private`) | `updatePrivacyAction` -> `updatePrivacy` |
| Privacy | Hide from search | YES | same |
| Privacy | Read receipts | YES | same |
| Notifications | In-app (per event) | N/A - static "always on" `Check`, not a control | display only |
| Notifications | **Email (per event x5)** | **DEAD SWITCH** - rendered `disabled`; `onChange` can never fire, so `toggleEmail` never runs. Honestly labelled "Coming soon". | would call `updateNotificationPrefsAction` |
| Notifications | Push (device) | YES (real web-push) | `PushToggle` -> `enablePush`/`disablePush` |
| DM Permissions | everyone/connections/nobody | YES (optimistic + rollback) | `updateDmPermissionAction` |
| Language | English | static, no control | display only |
| Billing | Free plan | static, no control | display only |
| Account | Sign out | YES | `signOutAction` |
| Account | Delete account | YES (soft, 14-day) | `deleteAccountAction` |

- **Dead switch:** the 5 per-event **Email** toggles are `disabled` (`SettingsView.tsx:549-554`). They are honestly marked "Coming soon" and the persist path (`updateNotificationPrefs`) is wired, so this is honest-but-inert rather than a lie. NOTE a mismatch: the launch infra already ships a weekly-digest email (Resend, verified), yet this UI gives the user no working control to opt out of it here (the digest opt-out lives at `app/api/unsubscribe`, not in Settings). Worth reconciling so Settings governs the emails that actually send.
- **Missing states:** every write control has pending/saved/error (optimistic with rollback on Privacy, DM, notifications). Delete has a confirm overlay. Strong.
- **A11y:** `Switch` is `role=switch` + `aria-checked` + `aria-label`, and has a real `focus-visible:ring-2 ring-saffron` (the primitives should copy this). Delete overlay lacks focus trap / `role=dialog`/`aria-modal` (`:690-714`) - RUNTIME-CHECK.
- **Token violations:** none in SettingsView (stale "cobalt track" comment `:74` only).
- **Verdict:** POLISH
- **Planned fix:** (1) When email delivery ships, drop `disabled` on the email toggles. (2) Surface the weekly-digest opt-out here (or link to it) so Settings is the single source of email control. (3) Add `role=dialog`/`aria-modal`/focus-trap to the delete overlay.

## PushToggle (`components/composite/PushToggle.tsx`)
- **Purpose:** Device web-push enable/disable with supported/denied/error messaging.
- **Defects:** `:74` error text uses `text-red-600` - a non-token Tailwind color. Every other error in the app uses `text-ember`. Token violation + inconsistency.
- **Missing states:** supported=false, denied, generic error, busy(spinner) all handled. Good.
- **A11y:** button labelled by text; disabled while busy.
- **Token violations:** `:74` `text-red-600` -> should be `text-ember`.
- **Verdict:** POLISH
- **Planned fix:** `text-red-600` -> `text-ember`.

---

## Analytics (`app/(app)/analytics/page.tsx`) + `lib/db/analytics.ts` - HONESTY CHECK
- **Purpose:** Creator analytics: totals, reach/engagement time series, top posts, profile viewers.
- **Synthetic-data finding: NONE. Data is 100% real.** Every number derives from logged data: `posts.impressions` (bumped by real feed events), trigger-maintained `{like,comment,repost,bookmark}_count`, `creator_impressions_daily`/`creator_engagements_daily` RPCs over `feed_events`, `profile_views`, `follows`/`connections` with real counts. The per-post "Feed score" is the SAME Bayesian rate the ranker uses (`eng / (impr + 20)`), and the page explains that formula to the user. `getCreatorAnalytics` has zero stubs/`Math.random`/placeholder arrays; the header comment ("NOTHING stubbed") matches the code. This is a model of the honesty rule.
- **Missing states:** charts guard on `>= 2` points and fall back to `EmptyChart`; top posts + viewers have empty states; stat cards show real `0`. `analytics/loading.tsx` exists.
- **A11y:** `MiniChart` `<svg role=img>` with a descriptive `aria-label` (peak + total); bars/points have `<title>` tooltips; "Only you can see this" chip.
- **Token violations:** none (`MiniChart` reads `var(--color-saffron|moss|bone)`).
- **Verdict:** KEEP (`analytics/page.tsx`, `analytics.ts`, `MiniChart.tsx`, `StatCard.tsx` all clean)

---

## Admin - Feedback (`app/(admin)/feedback/page.tsx`)
- **Purpose:** Feedback triage inbox with status tabs, counts, per-item triage.
- **Defects:** none functional. Admin-gated by `(admin)/layout.tsx`.
- **Missing states:** tab-aware empty states; counts. `FeedbackTriage` handles actions (not in slice).
- **A11y:** `aria-current` on active tab; author/anonymous handled.
- **Verdict:** KEEP (internal tool, appropriately lower design bar, nothing dead)

## Admin - Review queue (`app/(admin)/queue/page.tsx`)
- **Purpose:** Moderation queue; dismiss / remove post / suspend user via server-action forms.
- **Defects:** **BROKEN LINK.** `:93` "Open post" links to `/p/${it.post_id}`, but `it.post_id` is the post UUID (`moderation_queue` view exposes `reports.post_id` -> `posts.id`; confirmed in `supabase/migrations/0003_views_and_jobs.sql:64`). The route `/p/[short_id]` resolves via `getPostByShortId(short_id)` (`app/p/[short_id]/page.tsx:17,49`), which expects the `short_id`, not the UUID. So every "Open post" link 404s. (Search rows correctly use `/p/${post.short_id}`.) The action buttons (dismiss/remove/suspend) use `post_id` correctly for DB ops - only the reviewer's "Open post" preview link is dead.
- **Missing states:** empty ("All clear") present. Actions are `<form action=>` server actions (pending state relies on default form behavior - no per-button spinner).
- **A11y:** raw `"..."` quotes around report body (`:83`) instead of typographic - cosmetic only. Buttons use the `Button` primitive.
- **Token violations:** none.
- **Verdict:** POLISH
- **Planned fix:** Add `p.short_id as post_short_id` to the `moderation_queue` view and link `/p/${it.post_short_id}`; add it to the `QueueItem` type.

## FeedbackWidget (`components/composite/FeedbackWidget.tsx`)
- **Purpose:** Floating feedback/bug launcher + modal, submits to `submitFeedbackAction`.
- **Defects:** none material.
- **Missing states:** pending ("Sending..."), success screen, error alert, disabled-until-valid all present.
- **A11y:** `role=dialog`/`aria-modal`/`aria-labelledby`, Escape close, scroll lock, focus-on-open, `role=radiogroup`/`radio`, `role=alert` on error, safe-area insets. Strong. (One nit: focus is not trapped inside the dialog.)
- **Token violations:** none.
- **Verdict:** KEEP

---

## AppShell (`components/layout/AppShell.tsx`) - question 1
- **Purpose:** The whole signed-in chrome: desktop sidebar (11 nav items), sticky top bar (search + bell + avatar), mobile bottom nav (5) + "More" sheet.
- **Active states:** correct. `isActive = path === href || path.startsWith(href + "/")` and `aria-current="page"` set on desktop nav, bottom nav, and More sheet. Active = `bg-ink text-cream` (desktop) / `text-saffron` (bottom). Good contrast, consistent.
- **Notification badge realness:** REAL. The bell is `NotificationBell` (live Supabase realtime channel: INSERT increments, UPDATE read decrements, deduped via `seenUnread` set, seeded from a real server `unreadCount`). The DM badge is LIVE too - reads `MessagesProvider.unreadCount` so it ticks on every page, clears on any `/messages` route, `9+` cap. Neither badge is fake/static.
- **Mobile bottom-nav ergonomics:** 5 items + More, each `flex-1` with `py-1.5` and a `size-5` icon + `text-[10px]` label. The tappable column is full-width/`flex-1` (good width) but total height is roughly `icon 20 + gap + 10px label + py-1.5*2` ~ under the 44px target; the visual row is short. Bottom nav sits above the safe-area? It uses `bottom-0` with no `env(safe-area-inset-bottom)` padding, so on notched iOS the last row can collide with the home indicator (FeedbackWidget DOES honor safe-area; the bottom nav does not). RUNTIME-CHECK.
- **Overflow/scroll traps:** desktop sidebar is `fixed inset-y-0` with a lot of content but no `overflow-y-auto`; on a short viewport the 11-item nav + profile + "New post" could clip with no scroll. RUNTIME-CHECK. Main content reserves `md:ml-60` and `pb-24` for the bottom nav (correct). "More" sheet locks body scroll (good).
- **Defects:** bottom nav missing safe-area padding (`:244`); sidebar has no overflow fallback (`:109`); tap-target height on bottom nav marginal.
- **A11y:** `aria-current` throughout; icon-only bell/avatar/More all have `aria-label`/`aria-expanded`. Good.
- **Token violations:** none.
- **Verdict:** POLISH
- **Planned fix:** add `pb-[env(safe-area-inset-bottom)]` to the bottom nav; add `overflow-y-auto` (min-h-0) to the sidebar inner column; bump bottom-nav row to >=44px.

## NotificationBell (`components/layout/NotificationBell.tsx`)
- Real realtime, dedupe-safe, re-seeds on server count change. KEEP.

---

## Primitives - question 5 (drift inventory)

**Button (`components/primitives/Button.tsx`)**
- Defined variants: `primary | secondary | ghost | destructive | link`. Sizes: `sm | md | lg | xl`. Prop `withArrow`.
- Usage across app: `secondary` 18, `primary` 10, `ghost` 6, `destructive` 2. **`link` variant: 0 usages (dead).** **`withArrow`: 0 usages (dead).** `xl` size: 1 usage (near-dead). `sm/md/lg` used broadly.
- **Bigger drift:** most "buttons" in this slice are NOT the `Button` primitive at all - they are hand-rolled `<button>`/`<a>` with bespoke classes: InShorts "Read in app" + external chip, all `NewsActions` pills, `EventCard`/event-detail "Register", `PushToggle`, `FeedbackWidget` (launcher + footer), the /t Top-Latest toggle, /events filter chips, `SettingsView` nav + `Switch`. The primary-action pill patterns (`bg-ink ... hover:bg-saffron` and `bg-saffron ... hover:bg-saffron-dk`) are re-implemented ~10x. The primitive is under-adopted.
- **Defect:** no `focus-visible` ring on `Button` (relies on the browser default outline; the `Switch` in SettingsView has a proper `focus-visible:ring-saffron` the primitive should adopt).
- **Verdict:** POLISH - remove dead `link`/`withArrow` or start using them; add a focus-visible ring; migrate the bespoke primary/secondary pills onto `Button` (add a `pill`/`rounded-full` shape variant so the news/event CTAs fit).

**Input (`components/primitives/Input.tsx`)**
- One shape only (fixed `h-12`), label optional. No size variants, no error/`aria-invalid`/helper-text support, no `focus-visible` ring - `focus:outline-none` removes the outline and only changes border to ink (low-contrast focus indicator). Used in 11 files; `EventForm`/`SettingsView` re-declare the same class for selects/dates, so the weak-focus pattern is copied. **Verdict:** POLISH - add a `focus-visible` ring, an error state, and (optionally) size variants; make selects/dates share it.

**Card (`components/primitives/Card.tsx`)** - clean, but note many surfaces use a global `.card`/`.card-hover` utility (e.g. NewsRail, explore) instead of `<Card>`, so `<Card>` itself is lightly used. KEEP.

**Tag (`components/primitives/Tag.tsx`)** - variants `default|saffron|moss|outline`, all used. Clean. KEEP.

---

## Motion

**CountUp (`CountUp.tsx`)** - rAF count on in-view, en-IN format. Used 3x. Defect: no `prefers-reduced-motion` guard (animates regardless). POLISH.

**MagneticButton (`MagneticButton.tsx`)** - used 1x (landing). Defects: the interactive element is a `motion.div` with `onClick` but no `role`/`tabIndex`/keyboard handler; when `href` is set the `onClick` is on the inner div, not the `<a>`. Not keyboard-operable; no reduced-motion guard. POLISH (a11y).

**Marquee (`Marquee.tsx`)** - **0 usages anywhere in app/components (dead code).** Also infinite animation with no reduced-motion guard. REBUILD-or-remove: delete if truly unused, else add a reduced-motion stop.

**SplitWords (`SplitWords.tsx`)** - used 2x; correct `aria-label` on the wrapper + `aria-hidden` on the animated spans (accessible). No reduced-motion guard (motion respects it globally only if configured). KEEP (add reduced-motion for parity).

**LenisProvider (`LenisProvider.tsx`)** - smooth-scroll restricted to `/` + `/about`; intercepts hash links; cleans up. Note: `InShortsFeed` uses `data-lenis-prevent` but /news never runs Lenis, so that attribute is a harmless no-op. KEEP.

Cross-motion a11y gap: only `Reveal` honors `prefers-reduced-motion`; `CountUp`, `Marquee`, `MagneticButton`, `SplitWords` do not.

---

## Brand

**Wordmark (`Wordmark.tsx`)** - single source of truth for the lockup (mark + "Collab47", single ink color, no trailing dot). Clean, well-documented. KEEP.

**opengraph-image (`app/opengraph-image.tsx`)** - Defect: renders the wordmark as `Collab` + `<span color #B95402>47</span>` (`:45-46`) - the exact two-tone "Collab" + colored "47" form the `Wordmark.tsx` docstring says was eliminated as drift. So brand drift the wordmark killed still lives in the share card. Hardcoded hex here is acceptable (next/og cannot read CSS vars), but the two-tone form should be reconciled to the single-color lockup. POLISH.

**manifest (`app/manifest.ts`)** - hardcoded `#FBF8F4`/`#B95402` are unavoidable (manifest JSON, no CSS vars) and are correctly documented as the cream/saffron tokens. KEEP.

---

## Cross-cutting

1. **Loading/error boundaries are uneven.** `(app)` and `events` and `analytics` have skeletons; `(content)` (news list, `/news/[id]`, `/t/[tag]`) and `(admin)` have NO route-level `loading.tsx`, and there are NO `error.tsx` boundaries anywhere in the slice. Connection failures degrade to empty states (dishonest "no content"). Add group-level `loading.tsx` + `error.tsx` for `(content)` and `(admin)`.

2. **Focus indicators are the systemic a11y gap.** `Input`, `Button`, and the hand-rolled selects/dates in `EventForm` either remove the outline (`focus:outline-none` + border-only) or add no `focus-visible` ring. The one correct pattern is `SettingsView`'s `Switch` (`focus-visible:ring-2 ring-saffron ring-offset`). Standardize that ring on all primitives.

3. **Button primitive is under-adopted.** ~10 bespoke primary/secondary "pill" buttons across news/events/settings/feedback reimplement `bg-ink/bg-saffron` hover logic by hand. Add a `rounded-full`/`pill` shape variant to `Button` and migrate; delete the dead `link` variant + `withArrow` prop (0 uses).

4. **Hardcoded / off-token colors (violations):** `EventCard.tsx:22,189` `text-[#9A6A00]`; `EventCard.tsx:98` gradient `#047857` (emerald, should be moss); hardcoded gradient hexes in `EventCard.tsx:96-99`, `InShortsFeed.tsx:163`, `news/[id]/page.tsx:95`; `PushToggle.tsx:74` `text-red-600` (should be ember). Tokenize into a shared brand-gradient util + fix the ember/gold swaps. (manifest/OG hexes are acceptable given their contexts.)

5. **`prefers-reduced-motion`** honored only by `Reveal`; add guards to `CountUp`, `Marquee`, `MagneticButton`, `SplitWords`.

6. **Reduced honesty-on-failure in optimistic writes:** `NewsActions` save, and several `lib/db` functions returning `{ ok: true }` when the client is null, mean a down DB can look successful. Prefer explicit failure so optimistic UIs can roll back.

7. **Dead / near-dead code:** `Marquee` (0 uses), `Button` `link` variant + `withArrow` (0 uses), `Button` `xl` (1 use). Stale "cobalt" comments in `SearchResults.tsx` and `SettingsView.tsx` (code uses saffron).

8. **Two genuinely functional bugs (not just polish):**
   - `InShortsFeed` fixed offsets (`top-16/bottom-16/md:left-60`) assume the member `AppShell`; the `(content)` layout serves anonymous visitors a `PublicTopNav`-only shell with no sidebar/bottom-nav, so logged-out `/news` (the indexable target) is mispositioned. (RUNTIME-CHECK.)
   - `queue/page.tsx:93` "Open post" 404s (links post UUID into the `short_id` route).

RUNTIME-CHECK items: logged-out `/news` layout offsets; bottom-nav 44px tap height + iOS safe-area collision; desktop sidebar overflow on short viewports; delete-account overlay focus trap; events chip tap height.
