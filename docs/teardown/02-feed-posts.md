# Teardown 02 - Feed & Posts

Read-only design-engineering audit. Slice: home feed, post detail, composer, comments,
realtime, and the data layer feeding them. Standards audited against are the locked
Collab47 tokens/type/state rules. Items that cannot be settled from source are marked
**RUNTIME-CHECK**.

---

## HomePage (`app/(app)/home/page.tsx`)
- **Purpose:** Server component: fetches the "For you" first page + rail data, renders the `FeedClient` island in a two-column shell.
- **Defects:**
  - `page.tsx:38` comment says the card hydration and follow-state "run concurrently" but `await toCardsWithEng(...)` runs strictly after the `Promise.all` - the comment is stale/misleading (no correctness bug, but the "run them concurrently" claim is false).
  - `page.tsx:1-2,10-13` `Link`, `Tag`, `TrendingUp`, `Sparkles`, `Hash` are imported but never used in the returned JSX (the trending rail was gutted to an empty `<aside>`). Dead imports.
  - `page.tsx:41-51` builds a `trending` list but only its `.map((t)=>t.tag)` feeds `suggestedTags`; the `count` is computed and discarded.
- **Missing states:** No error boundary for `getFeedPage`/`getMyProfile`. If `getFeedPage("foryou")` throws, the whole route 500s (there is an instant `loading.tsx` but no `error.tsx` in this segment - RUNTIME-CHECK whether a parent `error.tsx` exists). Empty first page is handled downstream by `HomeFeed`.
- **A11y:** `aside aria-hidden="true"` on the reserved ad column is correct. No landmark/`<h1>` for the feed region - the page has no heading at all, so screen-reader users land on an unlabeled stream.
- **Token violations:** None (uses `max-w-270`, grid tokens only).
- **Verdict:** POLISH
- **Planned fix:**
  - Delete the 5 unused imports and the stale "concurrently" comment.
  - Add a visually-hidden `<h1>Home feed</h1>` and wrap the feed column in a labeled landmark.
  - Add `error.tsx` for the segment (retry) so a feed-query failure degrades gracefully.

## HomeLoading (`app/(app)/home/loading.tsx`)
- **Purpose:** Instant route skeleton for `/home`.
- **Defects:**
  - Skeleton card geometry is close but not exact: real `PostCard` uses `border-b border-bone px-4 py-5 sm:px-5` and includes a social-proof row + action bar; the skeleton (`loading.tsx:20-32`) omits the action-bar row, so there is a small height pop when real cards replace it.
- **Missing states:** N/A (this is itself the loading state). Matches composer + tab bar geometry well.
- **A11y:** Pulsing blocks are decorative; fine. Could add `aria-busy`/`role="status"` but low priority.
- **Token violations:** None (`bg-bone`, `bg-cream`).
- **Verdict:** KEEP
- **Planned fix:** Optionally add a short action-bar skeleton row to each card block to kill the residual pop.

## createPostAction & post actions (`app/(app)/home/actions.ts`)
- **Purpose:** Server actions: create/delete/pin/unpin/highlight posts; media upload helper.
- **Defects:**
  - `actions.ts:24-52` `uploadMedia()` is **dead code** - the composer uploads client-side directly to Storage (`PostComposer.tsx:51-61`); nothing calls this server helper. Remove it (it also documents a "1MB body limit" workaround that no longer applies).
  - `actions.ts:82-93` splits hashtags on a single space only (`hashtagsRaw.split(" ")`) - tabs/newlines/commas from the composer's joined string are not handled here, but the composer already sanitizes, so low risk (defensive gap only).
- **Missing states:** Returns `{ok,error}` uniformly - good. `createPostAction` deliberately skips `revalidatePath` (documented, correct for the optimistic flow).
- **A11y:** N/A (server).
- **Token violations:** N/A.
- **Verdict:** POLISH
- **Planned fix:** Delete `uploadMedia`; align hashtag split with the composer's `/[\s,#]+/` regex for consistency.

## PostPage (`app/p/[short_id]/page.tsx`) - the "blast"
- **Purpose:** Full post detail page with author, body, media, action bar, comment thread + JSON-LD/OG metadata.
- **Defects (this is the root cause of the founder's "opening a post blasts the user's face"):**
  - **Layout-tree swap.** `/p/[short_id]` lives OUTSIDE the `(app)` route group. The feed lives in `app/(app)/home` under `app/(app)/layout.tsx` -> `AppShell` (left nav, DM provider, chrome). This page renders its OWN `<main className="min-h-dvh bg-cream">` + `<PublicTopNav/>` (`page.tsx:85-86`) and NO `AppShell`. So `router.push('/p/…')` from `PostCard.openPost` (`PostCard.tsx:194-197`) **unmounts the entire app shell and mounts a different top-level chrome**. The sidebar vanishes, a `fixed h-16` public header appears (`PublicTopNav.tsx:49`), scroll resets to 0. That whole-context replacement is the "blast."
  - **Body font explodes.** In the feed the body is `text-[0.95rem] leading-relaxed` (~17px @18px base, `PostCard.tsx:567`). Here the same text is `text-h3 leading-relaxed` (`page.tsx:116`) = `--text-h3: 1.4rem` (~25px). The exact same paragraph jumps ~48% larger on click - literally enlarges into the reader's face. `text-h3` is a heading token being used for running body copy.
  - **Loading->real geometry mismatch (large CLS).** `loading.tsx` (this segment) renders `mx-auto max-w-2xl px-4 py-6` with a `.card` and NO top nav; the real page renders `container-edit max-w-2xl pt-32 pb-20` under a `fixed` `PublicTopNav`. So the skeleton paints near the top, then the real content slams down `pt-32` (8rem) and a fixed header pops in - a big vertical jump right after navigation.
  - **Staggered reveal on the whole post.** Every block (author, body, each media, tags, actions, comments) is wrapped in `Reveal` with delays `0 -> 0.05 -> 0.1 -> 0.15 -> 0.2 -> 0.25` (`page.tsx:89-165`). Immediately after the jarring nav the entire post fades+slides in in sequence, amplifying the "blast."
  - **Media layout shift.** Detail images are raw `<img className="w-full rounded-lg border">` with no width/height or aspect box (`page.tsx:120-124`); the feed's `PostMedia` caps heights and frames tiles. So images reflow the page as they load (CLS) - the opposite of the "fixed aspect ratios, no layout shift" rule.
- **Missing states:** Post-not-found -> `notFound()` (good). No error state if `getMyEngagementState`/`getPostComments`/`getCommentLikeState` throw (route 500s; RUNTIME-CHECK for `error.tsx`). No loading state for comments beyond the one-shot server render (they arrive with the page).
- **A11y:** JSON-LD via `dangerouslySetInnerHTML` (`page.tsx:87`) is fine (trusted, own data). `<img alt="">` (`page.tsx:122`) decorative-only on the *primary* content image is questionable - a lone post image with empty alt gives SR users nothing. Author `<Link>` wraps avatar+name (good).
- **Token violations:** None in this file (`bg-cream`, `text-ink`, `text-ash`, `border-bone`). The violation is *typographic*, not color: `text-h3` for body copy.
- **Verdict:** REBUILD (the open-experience, not the data fetching)
- **Planned fix:**
  - Move post detail INTO the `(app)` group (e.g. `app/(app)/p/[short_id]`) or render it as an intercepting/parallel route/modal so the app shell never unmounts and scroll is preserved; keep the standalone public route only for logged-out share views.
  - Set body to `text-body`/`text-body-lg` (Inter), not `text-h3`; reserve `text-h3` for headings.
  - Make `loading.tsx` mirror the real geometry (same container, same top offset, same shell) so there is no jump.
  - Give detail images a fixed aspect container like `PostMedia` (reuse it) to eliminate CLS.
  - Drop or greatly reduce the per-block `Reveal` stagger on the detail page (a single quick fade at most).

## PostLoading (`app/p/[short_id]/loading.tsx`)
- **Purpose:** Instant skeleton for the post route.
- **Defects:** Geometry does not match the real page (see above): no `PublicTopNav` allowance, `py-6` vs `pt-32`, `.card` wrapper the real page does not use. This is a contributor to the "blast."
- **Missing states:** N/A (is the loading state).
- **A11y:** Decorative; fine.
- **Token violations:** None.
- **Verdict:** REBUILD (align to real page)
- **Planned fix:** Rebuild to match whatever the post detail becomes (same shell, same top offset, same container/width).

## Comment actions (`app/p/[short_id]/actions.ts`, `comment-like-actions.ts`)
- **Purpose:** Server actions for add/delete comment and like/unlike comment.
- **Defects:**
  - `actions.ts:12` `addCommentOnPostAction` calls `revalidatePath('/p')` - `/p` is not a real route (posts live at `/p/[short_id]`); this revalidate is a no-op/misdirected. Delete uses the correct `revalidatePath('/p/[short_id]','page')` (`actions.ts:19`). Inconsistent and the add-path revalidate does nothing.
  - Because the client is fully optimistic, these revalidates mostly do not matter, but the mismatch is a latent bug if anyone relies on it.
- **Missing states:** Return `{ok,error}` uniformly (good).
- **A11y:** N/A.
- **Token violations:** N/A.
- **Verdict:** POLISH
- **Planned fix:** Fix `addCommentOnPostAction` to `revalidatePath('/p/[short_id]','page')` (or drop it entirely, matching the optimistic model).

## FeedClient (`components/composite/FeedClient.tsx`)
- **Purpose:** Client island owning tab state, lazy per-tab loading, prefs, and optimistic post insert/resolve.
- **Defects:**
  - **No error surface on page-load failure.** `fetchPage`'s catch (`FeedClient.tsx:76-77`) sets `{loading:false, loaded:true}` and swallows the error - the user then sees the empty state or "all caught up" with no indication anything failed and no retry. Violates the required list **error (retry)** state.
  - `fetchPage` depends on `[tabs]` (`FeedClient.tsx:82`) so the callback is re-created on every tab-state change; combined with the `inFlight` ref guard it works, but `cursor`/`excludeIds` are read from the `tabs` closure at call time - fine, but brittle.
  - Optimistic insert only targets `foryou` + `recent` (`FeedClient.tsx:143-149`); if the user is viewing `popular`/`trending` when they post, their new post does not appear at all until refresh (no feedback that it landed on other tabs).
- **Missing states:** Loading (delegated to HomeFeed) OK; **error state missing** (above); empty/end delegated to HomeFeed.
- **A11y:** N/A (delegates rendering).
- **Token violations:** None.
- **Verdict:** POLISH
- **Planned fix:**
  - Track a per-tab `error` flag; render an inline "Couldn't load - Retry" row in `HomeFeed` when set.
  - When posting while on popular/trending, either switch to For-you or show a toast "Posted - see it in For you."

## HomeFeed (`components/composite/HomeFeed.tsx`)
- **Purpose:** Renders the sticky tab bar + the posts list with infinite scroll, skeletons, empty, and end states.
- **Defects:**
  - **Empty state has coaching but no real CTA.** `EMPTY_COPY` (`HomeFeed.tsx:152-169`) is plain text - "Head to Explore to find builders" / "Follow people or post something" are not links or buttons (`HomeFeed.tsx:190-201`). The rule requires **coaching + CTA**; there is no tappable action.
  - **No error state.** The list has loading/empty/end but nothing for a failed fetch (pairs with FeedClient's swallowed error). A failed page silently shows the end/empty UI.
  - Infinite-scroll "kick" effect (`HomeFeed.tsx:74-81`) calls `onLoadMore()` in a layout effect keyed on `posts.length`; on a very tall viewport this can chain several loads - acceptable but worth a max-pages guard. RUNTIME-CHECK for runaway loading on large screens.
  - Appended pages (index >= 6) intentionally do not animate (`HomeFeed.tsx:219`) - good; but the first-page stagger delay caps at 0.3s which is fine.
- **Missing states:** Error (retry) **missing**; empty CTA **missing (partial)**. Loading skeletons present and match geometry; end-of-list present.
- **A11y:** Tab bar uses `role="tablist"`/`role="tab"`/`aria-selected` (`HomeFeed.tsx:99-116`) but the panel below has no `role="tabpanel"`/`aria-labelledby`, and tabs are not linked to a panel id. Tab buttons are `min-h-11` (>=44px) - good. Underline uses `layoutId` disabled under reduced motion - good.
- **Token violations:** None (`bg-cream/90`, `border-bone`, `bg-saffron`, `text-moss`).
- **Verdict:** POLISH
- **Planned fix:**
  - Add an error row with a Retry button driven by FeedClient's per-tab error flag.
  - Turn empty-state copy into a real CTA (Explore link / focus composer button).
  - Add `role="tabpanel"` + `aria-labelledby` wiring; cap consecutive auto-loads.

## FeedFilters (`components/composite/FeedFilters.tsx`)
- **Purpose:** Two toggle chips ("People I follow", "Hide projects") that persist prefs and re-filter tabs.
- **Defects:**
  - Persist is fire-and-forget inside `useTransition` (`FeedFilters.tsx:35-37`); `updateFeedFiltersAction` failure is ignored - the chip flips visually and the feed refetches, but the pref never saved. Silent failure (low stakes, but no feedback).
  - Local `prefs` state (`FeedFilters.tsx:26`) duplicates FeedClient's `prefs`; the two can drift if `initial` changes (it never does here, so OK).
- **Missing states:** No pending/failure indication on the chip (async action silent-failure rule).
- **A11y:** `aria-pressed` set correctly (`FeedFilters.tsx:48`); chips are `h-9` (~36px, **under the 44px tap target** at default zoom despite the 18px base making it ~40px - RUNTIME-CHECK exact px, but nominally short).
- **Token violations:** None (`bg-saffron`, `text-cream`, `border-bone`, `bg-paper`).
- **Verdict:** POLISH
- **Planned fix:** Bump chip height to `h-11`; on persist failure revert the toggle and show a subtle inline error/toast.

## FeedRealtimeProvider (`components/composite/FeedRealtimeProvider.tsx`)
- **Purpose:** (Intended) one Supabase Realtime channel fanned out to on-screen cards, with an 8s poll fallback.
- **Defects:**
  - **Entire file is dead code.** Grep confirms `FeedRealtimeProvider` and `useFeedRealtime` are imported nowhere. Live counts are actually handled by `lib/realtime/postCounts.ts` `subscribePostCounts`, which `PostCard.tsx:181` uses. This ~140-line provider is orphaned and its doc-comment ("ONE Supabase Realtime channel for the whole app shell") describes behavior the app no longer uses.
- **Missing states:** N/A.
- **A11y:** N/A.
- **Token violations:** N/A.
- **Verdict:** REBUILD (delete)
- **Planned fix:** Delete the file (and confirm `lib/realtime/postCounts.ts` is the single source of truth). If kept for public pages, wire it or document why.

## FeedTracker (`components/composite/FeedTracker.tsx`)
- **Purpose:** IntersectionObserver-based impression (>=50% for >=800ms) + dwell capture, batched to a server action.
- **Defects:**
  - Uses a `MutationObserver` on `document.body` subtree (`FeedTracker.tsx:77-78`) that runs `scan()` on every DOM mutation app-wide - on a busy shell this fires often; `scan()` re-queries `[data-feed-post]` each time. Works, but is a broad, high-frequency observer. RUNTIME-CHECK perf on long sessions.
  - `flush` is fire-and-forget (`FeedTracker.tsx:31`); dropped batches on failure are acceptable for telemetry.
- **Missing states:** N/A (invisible telemetry component; returns `null`).
- **A11y:** N/A.
- **Token violations:** N/A.
- **Verdict:** KEEP
- **Planned fix:** Optionally throttle/debounce `scan()` and scope the MutationObserver to the feed container rather than `document.body`.

## PostCard (`components/composite/PostCard.tsx`)
- **Purpose:** The feed card: author, clamped body with "see more", media, live counts, and optimistic like/react/save/repost/share + owner menu.
- **Defects:**
  - **Clickable body is not keyboard-accessible.** The body `<p onClick={openPost}>` (`PostCard.tsx:564-572`) has `cursor-pointer` but no `role`, `tabIndex`, or key handler - keyboard/SR users cannot open the post from the body (they can still reach the comment `<Link>` at `:666`, so not a total block, but the primary open affordance is mouse-only).
  - **Dead reaction machinery.** `REACTIONS` (`:64-71`), `getReactionMeta` (`:73`), `pickReaction` (`:254`), `openReactionPopover`/`cancelReactionPopover` (`:274-280`), `reactionRef`, `hoverTimerRef`, and the reaction-popover outside-click effect (`:355-364`) exist, but no reaction popover is ever rendered in the JSX (the like button is a single tap, per the `:639-641` comment). All of that is dead weight.
  - `ReactionSummary` is passed `viewerReaction` (`:634`) but the component ignores it (`ReactionSummary.tsx:19`) - dead prop.
  - `handleShare` (`:298-316`): clipboard-fallback failure is silently swallowed (`:313-315`) - no "couldn't copy" feedback (minor).
  - "see more" appears only when `post.body.length > 320` (`:573`) yet the clamp is `line-clamp-6` (`:568`) - a 300-char post that still wraps past 6 lines gets clamped with no "see more" (text silently truncated). Threshold is char-based, clamp is line-based; they can disagree.
  - `absoluteTime` shown only via `title` (`:515`) - fine.
- **Missing states:** Like/react/save/repost all optimistic **with rollback** (`:204-342`) - good. Delete is optimistic-hide with error rollback (`:383-395`). Menu actions surface `menuError` (`:619`). Not-interested/show-fewer hide optimistically with no failure rollback (`:411-424`) - acceptable (low stakes) but silent.
- **A11y:** Icon buttons have `aria-label` (like/menu/action btns) - good. `aria-pressed` on like/save. Avatar duplicate link correctly `aria-hidden`+`tabIndex=-1` (`:476-486`). The clickable `<p>` gap is the main issue.
- **Token violations:**
  - `REACTIONS` (dead) uses `text-gold` and `text-saffron-dk` (`:66-70`) - these are *defined* CSS vars but `gold` is NOT in the locked 10-token palette; since the block is dead it is moot, but if reused it would introduce an off-palette color.
  - Live code uses only `text-saffron`, `text-moss`, `text-ash`, `text-ink`, `text-ember`, `bg-bone`, `border-bone` - clean. `bg-saffron/6` (`:440`) is an unusual opacity step but valid.
- **Verdict:** POLISH
- **Planned fix:**
  - Make the open affordance a real control: wrap the card in a keyboard-focusable link/button (or add `role="link" tabIndex=0` + Enter/Space on the body) while keeping child links from bubbling.
  - Delete the dead reaction popover code + the unused `viewerReaction` prop.
  - Reconcile "see more" threshold with the actual clamp (show it whenever the text is clamped, e.g. measure overflow).
  - Add a small "Couldn't copy link" fallback message to share.

## PostMedia (`components/composite/post/PostMedia.tsx`)
- **Purpose:** Feed media gallery (1/2/3/4/5+ layouts) + inline video, with double-tap-to-like burst.
- **Defects:**
  - Single-image tile uses `object-contain` with `max-h` but **no fixed aspect box** (`PostMedia.tsx:40-64`) - height depends on the image, so the card still shifts as the image loads (partial CLS; grid tiles use `aspect-square`/fixed `h-72` and are fine).
  - `<img alt="">` everywhere (`:53,184`) - decorative-only; a post whose content IS the image gives SR users nothing.
- **Missing states:** No image load/error placeholder - a broken URL shows a broken-image glyph inside the framed mat. Video has a play affordance (good) but no error state.
- **A11y:** Video play button has `aria-label="Play video"` (`:238`). Images lack meaningful alt (above).
- **Token violations:** None (`bg-ink/[0.04]`, `border-bone`, `bg-paper/90`).
- **Verdict:** POLISH
- **Planned fix:** Reserve space for the single-image case (aspect ratio from intrinsic size or a default box); add a subtle broken-image fallback; consider optional alt text.

## ReactionSummary (`components/composite/post/ReactionSummary.tsx`)
- **Purpose:** Honest aggregate social-proof row (single Like glyph + counts).
- **Defects:** Accepts `viewerReaction` but never uses it (`:11,19`) - dead prop.
- **Missing states:** Returns `null` when all zero (correct).
- **A11y:** Purely presentational counts; fine. Could add an `aria-label` summarizing counts.
- **Token violations:** None (`bg-saffron`, `text-cream`, `text-ink/75`, `border-bone/70`).
- **Verdict:** KEEP
- **Planned fix:** Drop the unused `viewerReaction` prop.

## PostComposer (`components/composite/PostComposer.tsx`)
- **Purpose:** Create-post composer: body, image/video upload (client-side to Storage), hashtag chips, optimistic submit.
- **Defects:**
  - `formRef` (`:88`) is set but never used.
  - `getSupabaseBrowser()` is called on every render to compute `isDemo` (`:70`) and again in submit - cheap but repeated.
  - On a successful post while media was attached, `resetForm` revokes object URLs (`:100-102`) - correct. But if the component unmounts mid-upload (user navigates), object URLs are not revoked (minor leak).
- **Missing states:** Pending ("Posting..." + disabled + per-image/video spinner overlay, `:433-436,474-477`) - good. Success -> `resetForm` (`:329`). Failure -> `serverError` inline (`:493`), and crucially the form is **NOT reset on failure** so typed text/media survive (answers Q2 - see below). Media validation errors inline (`:492`). Strong state coverage.
- **A11y:** Textarea and hashtag input have placeholders but **no `aria-label`/`<label>`** (`:382-399,513-527`). Remove-image/remove-video buttons have `aria-label` (`:441,482`) - good. Char counter is visual-only (not announced). Submit disabled state clear.
- **Token violations:** None (`bg-cream`, `border-bone`, `text-saffron`, `border-saffron`, `text-ember`, `text-gold`). Note `text-gold` used for the "approaching limit" counter (`:576`) - `gold` is a defined var but outside the locked 10-token list; borderline.
- **Verdict:** KEEP (POLISH the a11y)
- **Planned fix:**
  - Add real labels (visually-hidden) to the textarea and hashtag input; announce the char counter via `aria-live`.
  - Remove unused `formRef`; revoke object URLs on unmount.
  - Reconsider `text-gold` counter color vs the locked palette (use `ash`/`ember` steps).

## PostDetailActions (`components/composite/PostDetailActions.tsx`)
- **Purpose:** Action bar on the post detail page: reaction picker, comment count, bookmark, repost, share, report.
- **Defects:**
  - **Token violations (live, not dead).** The `REACTIONS` palette uses raw Tailwind default colors: `text-amber-500`, `text-rose-400`, `text-red-500`, `text-blue-400`, `text-green-500` (`:39-43`). None are Collab47 tokens, and they are rendered in the popover (`:216-231`). This directly violates the locked palette and is inconsistent with `PostCard`'s (token-based) reaction colors.
  - **Bookmark/repost counts not optimistic.** `toggleSave` flips the icon and rolls back (`:165-172`) but never updates `bookmarkCount` (a static prop) - the number stays stale until refresh. `handleRepost` (`:152-163`) shows a toast but never bumps a repost count (none shown). `commentCount` is also static. So on the detail page, counts do not move (contrast with the feed's live counts).
  - **No realtime on detail.** Unlike `PostCard`, this component never subscribes to `subscribePostCounts`, so another user's like/comment/save does not tick here (see Cross-cutting - realtime is feed-only).
  - `getReactionMeta` defined (`:46`) and used for the main button (`:194`) - OK here (not dead, unlike PostCard).
- **Missing states:** Like/react optimistic **with rollback** (`:95-142`) - good. Save optimistic-with-rollback on the icon only (count stale). Repost: pending via `isPending`, success toast, failure -> `actionError` inline (`:339`). Share failure silently swallowed (`:189-191`).
- **A11y:** All buttons have `aria-label` (`:241,264,283,300,314,325`). Reaction popover buttons labeled (`:222`). Reaction buttons are `size-9`/`size-8` (~40-32px) - **under 44px** tap target. Report button is icon-only with label (good).
- **Token violations:** `:39-43` (the five raw palette colors) - the headline violation of this file.
- **Verdict:** REBUILD (bring to token parity + optimistic counts)
- **Planned fix:**
  - Replace the five raw Tailwind reaction colors with the tokenized set used in `PostCard` (`text-saffron`/`text-moss`/`text-ember`/... ) - and factor the reaction config into one shared module so the two bars can never drift.
  - Make bookmark bump `bookmarkCount` optimistically; subscribe the detail page to `subscribePostCounts` so counts + comments tick live.
  - Bump reaction/popover tap targets to >=44px.

## CommentsSection (`components/composite/CommentsSection.tsx`)
- **Purpose:** Comment thread (1-level replies), optimistic add/delete/like, reply mentions.
- **Defects:**
  - **A comment can be lost on failure (answers Q5).** `submit` clears `body` and `replyTo` immediately (`:187-188`) before the server confirms. On failure it removes the optimistic comment and sets `error` (`:197-201`) but **does not restore the typed text** - the user must retype the whole comment. The optimistic comment also has no "sending"/pending affordance, so on failure it simply disappears.
  - No length/empty error beyond the disabled Send; server-side max is 600 (`engagement.ts:72`) and the textarea caps at 600 (`:328`), consistent.
  - `relativeTime` is re-implemented here (`:11-19`) and also in `lib/ui/toCardPost` - duplication.
  - Optimistic like on a not-yet-persisted comment is blocked (`:73`) - good guard.
- **Missing states:** Add: optimistic insert + failure rollback + inline error (`:195-201`) but **loses input** (above). Delete: optimistic with snapshot rollback + error (`:110-121`) - good. Like: optimistic + rollback (`:71-105`) - good. Empty list state present ("No comments yet. Be first.", `:211`). No pending indicator on the optimistic comment itself.
- **A11y:** Like/delete buttons have `aria-label`/`aria-pressed` (`:129,147-148`). The comment textarea has a placeholder but **no label** (`:326-332`). Send button conveys pending only as "..." (not announced).
- **Token violations:** None (`bg-cream`, `border-bone`, `bg-saffron`, `text-cream`, `text-ember`, `text-ink`, `text-saffron`).
- **Verdict:** POLISH
- **Planned fix:**
  - On failure, restore `body` (and `replyTo`) so the comment is never lost; or keep the optimistic comment visible in a "failed - retry/delete" state instead of removing it.
  - Add a "sending" style to the optimistic comment; add a label to the textarea.
  - Reuse the shared `relativeTime`.

## Reveal (`components/motion/Reveal.tsx`)
- **Purpose:** Scroll-in fade+rise wrapper (and `Stagger`), reduced-motion aware.
- **Defects:**
  - **Content-hidden-without-JS risk.** `initial={{opacity:0}}` via motion inline styles means SSR paints the wrapped content at `opacity:0`; it only becomes visible once motion hydrates and `useInView` fires. If hydration is slow/blocked, content stays invisible. On the post detail page EVERYTHING is wrapped in `Reveal`, so a hydration hiccup = a blank post. RUNTIME-CHECK, but a real fragility. (Reduced-motion is handled: `offset=0`, `duration=0`.)
  - `Stagger` treats `children` via `Array.isArray` and keys by index (`:88-94`) - fine for static lists.
- **Missing states:** N/A.
- **A11y:** Reduced-motion respected (`:29,34,42-44`) - good.
- **Token violations:** None.
- **Verdict:** KEEP (with caution)
- **Planned fix:** For above-the-fold/critical content (post detail), render visible by default and only animate as an enhancement (e.g. animate from a CSS class toggled after mount, or skip Reveal there). Do not gate primary content visibility on JS.

## lib/db/posts.ts
- **Purpose:** Post read/write helpers + repost attach + comment reads.
- **Defects:**
  - **Errors are swallowed into empty results.** `getPostByShortId`/`getProfilePosts`/`getPostComments`/`attachReposts` all destructure `{data}` and ignore `{error}` (`:79-87,92-100,254-260,55-59`). A DB/RLS error is indistinguishable from "no data" - the caller sees `null`/`[]`. This is why the feed/detail have no way to show an error state (there is no error to catch upstream). Write helpers do return `error.message`.
  - `getPostComments` caps at 200 with no pagination (`:259`) - long threads silently truncate.
- **Missing states:** Read helpers cannot express failure (return null/[]), which forces the missing error states in the UI.
- **A11y:** N/A.
- **Token violations:** N/A.
- **Verdict:** POLISH
- **Planned fix:** Return a discriminated `{data|error}` (or throw) from the read helpers so pages can render a real error/retry; paginate comments.

## lib/db/engagement.ts
- **Purpose:** Reactions, likes, comments, reposts, bookmarks + engagement-state read.
- **Defects:**
  - When Supabase is unconfigured, mutations return `{ok:true}` (`:14,57,176,273,281,316`) - a "success" for a write that never happened. In real prod this branch should not hit, but it makes the demo path lie to the optimistic UI (no rollback because "ok").
  - Duplicate-key handling is string-matching `error.message.includes("duplicate")` (`:16,288,308`) in some places and code `23505` in others (`:244`) - inconsistent; fragile across PG error formats.
  - Notifications are fire-and-forget inside the action (`:28-46` etc.) - fine, but a slow notification insert still runs within the request lifetime.
- **Missing states:** Returns `{ok,error}` for real failures - good; the `{ok:true}` on no-backend is the concern.
- **A11y:** N/A.
- **Token violations:** N/A.
- **Verdict:** POLISH
- **Planned fix:** Return `{ok:false,error:"…"}` when there is no backend so optimistic UI rolls back; standardize duplicate detection on the `23505` code.

## lib/db/comments.ts
- **Purpose:** Comment like/unlike + like-state batch read.
- **Defects:** `getCommentLikeState` ignores query `error` (`:55-59`) - same swallow pattern (returns empty). `likeComment` string-matches "duplicate" (`:16`).
- **Missing states:** Read cannot express failure.
- **A11y:** N/A.
- **Token violations:** N/A.
- **Verdict:** POLISH
- **Planned fix:** Surface read errors; standardize duplicate handling.

## lib/db/feed.ts (states trace)
- **Purpose:** Feed engine (for-you/recent/popular/trending) with pagination.
- **Defects:** Every path returns `{posts:[], nextCursor:null}` on no-client or empty pool (`:159,202,308,422,462,492,522,551`); Supabase query `error`s are not inspected, so a failed query yields an empty page that the UI renders as "all caught up"/empty. No error propagation = no possible UI error state.
- **Missing states:** No failure channel to the UI.
- **A11y:** N/A.
- **Token violations:** N/A.
- **Verdict:** POLISH
- **Planned fix:** Distinguish "query failed" from "no results" (throw or return an error marker) so `loadFeedPageAction`/`FeedClient` can show Retry.

---

## Cross-cutting

1. **The post-open "blast" (root cause).** `/p/[short_id]` is outside the `(app)` route group, so opening a post via `router.push` (`PostCard.tsx:194-197`) tears down the entire `AppShell` and mounts a different top-level chrome (`PublicTopNav`), resets scroll to 0, and (b) re-renders the same post body from `text-[0.95rem]` to `text-h3` (~17px -> ~25px), (c) with a `loading.tsx` whose geometry does not match the real page (no nav / `py-6` vs fixed nav / `pt-32`), (d) then fades every block in with a staggered `Reveal`. The fix is to keep post detail inside the app shell (in-group route or intercepting/modal route), use body type not `text-h3`, match the skeleton, and drop the stagger.

2. **No error/retry state anywhere in the read path.** The DB read helpers (`posts.ts`, `feed.ts`, `comments.ts`, `engagement.ts:getMyEngagementState`) swallow `error` into empty results, and `FeedClient.fetchPage`'s catch is silent. Net effect: a failed feed page or a failed detail load renders as "empty"/"all caught up" with no way to retry. This violates the "every list needs an error (retry) state" rule and is systemic, not per-component.

3. **Realtime is feed-only, despite "app-wide" claims.** `PostCard` subscribes to `subscribePostCounts` (live likes/comments/reposts/saves in the feed). The post **detail** page (`PostDetailActions`, `CommentsSection`) subscribes to nothing - counts and comments there are static until refresh. Separately, `FeedRealtimeProvider.tsx` (whose doc claims a whole-app channel) is **dead code** (imported nowhere). Q3 answer: only feed card counts update live; detail page and comment stream do not.

4. **Optimistic UI is good in the feed, uneven on detail.** Feed (`PostCard`) like/react/save/repost are optimistic **with rollback** (Q4 = yes). `PostDetailActions` like/react roll back, but save/repost/comment counts are static (not optimistic) and there is no realtime, so detail numbers feel frozen.

5. **Input-loss on comment submit (Q5).** `CommentsSection.submit` clears the textarea before the server confirms and does not restore it on failure - a failed comment is lost. (Composer, Q2, does the opposite and correctly: it does NOT reset on failure, so post text/media survive.)

6. **Token discipline is mostly clean; one live breach + one off-palette token.** Live breach: `PostDetailActions.tsx:39-43` uses raw Tailwind `amber/rose/red/blue/green` for reactions (off the locked palette, and inconsistent with `PostCard`). Off-palette-but-defined: `text-gold` (`#B45309`) appears in `PostComposer.tsx:576` and dead `PostCard` reaction code - `gold` is a real CSS var but not in the locked 10-token list. No raw hex literals found in components. Reaction color config is duplicated across `PostCard` and `PostDetailActions` and should be one shared module.

7. **Type/line-height rule.** Serif (Newsreader) line-heights in the tokens (`--text-h3--line-height:1.3`, display 1.16-1.18) satisfy the ">=1.16" rule. The typographic problem is not line-height but using the `text-h3` heading token for running body copy on the detail page.

8. **Tap targets.** Feed action buttons and tabs are `min-h-10`/`min-h-11` (OK). Under-44px offenders: `FeedFilters` chips (`h-9`), `PostDetailActions` reaction picker buttons (`size-9`/`size-8`). RUNTIME-CHECK exact px at the 18px base, but nominally short.

9. **A11y recurring gaps.** Clickable-but-not-focusable elements (`PostCard` body `<p>`), unlabeled form controls (composer textarea + hashtag input, comment textarea), missing `role="tabpanel"` wiring on the feed tabs, decorative `alt=""` on primary post images, and pending states conveyed only visually (no `aria-live`).

10. **Dead code to remove:** `FeedRealtimeProvider.tsx` (whole file), `actions.ts:uploadMedia`, `PostCard` reaction popover machinery (`REACTIONS`/`pickReaction`/hover handlers/effect), `ReactionSummary`'s `viewerReaction` prop, `PostComposer.formRef`, unused imports in `home/page.tsx`.
