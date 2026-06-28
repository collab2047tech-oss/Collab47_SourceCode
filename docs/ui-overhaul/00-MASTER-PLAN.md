# Collab47 - World-Class App Overhaul: MASTER PLAN

Synthesis of the 12 area plans in this folder. Order: **foundation first, then area by area** (each area fully done + on localhost for review before the next). Nothing skipped. Everything real, world-class, high-contrast, optimistic/instant. No fake/synthetic data, no em dashes, no Hindi-only text.

Cross-cutting decisions (locked with founder): **optimistic UI + client cache everywhere**; banners = **presets + upload + reposition**; build **foundation-first then area-by-area**.

---

## DB migrations needed (collected from all plans)
- `profiles`: `banner_preset text`, `cover_focal_x real`, `cover_focal_y real` (banner system); `last_name_change_at timestamptz`, `last_handle_change_at timestamptz` (7-day change limit).
- `hashtags.use_count`: trigger to populate on post insert/delete (real trending). Backfill once.
- RLS: tighten `posts` + profile-content reads so a PRIVATE profile's posts are NOT API-readable by strangers (currently `posts_read_public` + `profiles_read_public` leak everything - security hole flagged in 12).

---

## PHASE 0 - FOUNDATION (cross-cutting, ship first)  [plan 01, parts of 02/10]
0.1 **Optimistic-UI + client-cache layer (the "laggy" fix).** Remove `revalidatePath("/home")` from the 6 engagement actions (`app/(app)/home/engagement-actions.ts`) - it forces a full feed refetch on every like/react/bookmark/repost (~1s). Make all interactions optimistic (local state now, sync in background). Define the shared pattern (React `useOptimistic` + a light client cache/provider) every area reuses. Zero added cost.
0.2 **Auth-aware nav.** `app/c/[short_id]/page.tsx:34,84` imports the landing `Nav` -> logged-in users see "Log in / Get started". Route `/c`, and re-check `/about`,`/manifesto`, through the auth-aware `PublicTopNav`. A logged-in user must NEVER see the landing nav.
0.3 **Avatar "Y" bug.** `PostComposer.tsx:234` hardcodes `<Avatar name="You"/>`. Thread the real `name`+`avatar_url` (home already has `getMyProfile()`). Also `lib/ui/toCardPost.ts` never copies `avatar_url` -> feed avatars are always initials; fix so real photos show everywhere.
0.4 **Global contrast.** Fix every blended/invisible text (profile name on banner, moss-green sections, low-opacity text). Token-based; everything must pop.
0.5 **Fonts.** Confirm Sora/Inter cascade app-wide; remove any leftover Fraunces/Instrument/Hanken.

## PHASE 1 - FEED + COMPOSER + POST CARDS  [plans 02, 03]
1.1 `lib/ui/toCardPost.ts`: carry ALL `image_urls` + `video_url` + `avatar_url` (today it drops images 2-5 and every video, and all avatars).
1.2 Rich LinkedIn/IG post cards: media gallery + video player, clean author row, reactions, comments, share. Kill the "one-line blog" look.
1.3 World-class composer (photo/video/tag) UI.
1.4 **Infinite scroll** (cursor pagination) across all 4 tabs (today fixed 20 rows, no cursor).
1.5 Fix the tabs: Popular/Trending broken `engagementScore` (impressions default 30), Trending silently falls back to Popular (`feed.ts:305`); make For-you/Recent/Popular/Trending distinct + correct.
1.6 FeedFilters: `hide_news` is a dead chip (read by nothing) - wire it or remove honestly; verify only-follows/hide-projects apply.
1.7 Right-rail layout/scroll fix (interests + daily brief only show after scroll; scroll feels broken).
1.8 Optimistic engagement (instant like/react/comment).

## PHASE 2 - TRENDING + SEARCH + EXPLORE (discovery)  [plans 04, 07, 08]
2.1 Populate `hashtags.use_count` (trigger) -> real trending with a time window + velocity + personalised to the user's field (reuse the classical engine). One source of truth (home + explore disagree today). Fix tag links (`/explore?q=%23` vs `/t/[tag]`).
2.2 **Search (broken):** top-bar form posts `/explore?q=` but ExplorePage never reads `searchParams.q` -> query dropped. Read it; rank results (`.order`), add prefix/type-ahead + typo tolerance via existing `pg_trgm`; instant results dropdown.
2.3 Explore: rich + dense + real - matched people (with Follow), real trending, real featured projects, hashtag discovery. Remove the "featured = newest" fakery.

## PHASE 3 - NETWORK + PEOPLE + NOTIFICATIONS  [plans 05, 06]
3.1 `lib/ranker/people.ts` reusing the feed's `fieldProximity` + `semanticMatch` -> suggestions genuinely ranked by college/branch/interest. Fixes the **IISER Kolkata bug** (`getSuggestedConnections` does exact `.eq("college")` with no ranking, falls to random).
3.2 Network: Follow / Connect / Invite buttons real + optimistic (instant); connection requests (accept/reject) world-class.
3.3 Notifications: **real timestamps** - `created_at` is correct but server-formatted in UTC (`notifications/page.tsx:49`); compute relative time client-side in the viewer's locale + absolute-on-hover. World-class UI + optimistic mark-read.

## PHASE 4 - NEWS  [plan 09]
4.1 Every item gets a real summary (Groq summariser is real but capped 60/run -> long tail renders as "trash" cards); raise cap / backfill.
4.2 Remove the `branch_tags` chips + the fake serial-number badge from news cards; make cards look like REAL news (no raw URL/ID/points/comments-as-a-post).
4.3 Field-match/personalise news to the user (today zero server-side matching). World-class news UI.

## PHASE 5 - MESSAGING / DM  [plan 10]
5.1 `MessagesProvider` client cache + a single shared `ConversationRail` (today `getMyConversations` runs 2-4x per navigation; inbox opens in ~1s). Instant inbox.
5.2 Optimistic send (bubble appears instantly, image uploads in background); smooth world-class animations. Keep all real logic (realtime, permission matrix, groups, block/mute).

## PHASE 6 - PROFILE  [plan 11]
6.1 Banner system: ~18 CSS/SVG zero-asset presets (gradients/doodles/abstract/scenic) + upload (<=1MB) + Notion-style reposition (`objectPosition` via `banner_preset`/`cover_focal_x/y`); one shared `<ProfileBanner>`. `/u/[handle]` currently ignores `cover_url` - fix.
6.2 Name-invisible bug: `text-ink` h1 on the dark banner -> add a scrim/overlay or move it off the banner; guaranteed legible.
6.3 Profile score: visible ONLY to the owner, hidden from visitors (`/u/[handle]`).
6.4 Posts / Projects / Highlights tabs all real + working.

## PHASE 7 - ACCOUNT + SETTINGS  [plan 12]
7.1 Name + username change limited to once / 7 days (new `last_*_change_at` cols + friendly message; `updateProfile` has zero throttling today).
7.2 Public/Private profile (Instagram-style): private -> visitor sees ONLY basic info (banner, college/institution, profession, and connection/post/project COUNTS), NOT the content; account still discoverable. **Enforce in RLS** (current private branch is UI-only + bypassable).
7.3 Settings: every section real + working + world-class (privacy, notifications, DM perms, handle, deletion, logout).

---

## Open questions for the founder
1. Private profile: **DECIDED** - accepted connections/followers see FULL content (Instagram-style); everyone else sees only basics (banner, college/institution, profession, counts). Account stays discoverable. Enforce in RLS.
2. Trending + people + news personalisation reuse the SAME classical zero-AI engine (no new cost) - confirmed direction.
3. Banner presets: gradients + doodles + abstract + scenic, all generated (no stock photos) - confirmed.
