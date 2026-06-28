# 02 - Post Composer + Post Card UI Overhaul

Area: the post composer (`PostComposer.tsx`) and the feed post card (`PostCard.tsx`),
plus the data mapping (`toCardPost.ts`) and the actions that feed them.

Investigated, read-only. All file:line references are real and verified against the
current code on disk.

---

## 1. CURRENT STATE (what exists, what's broken / dead / fake)

### 1a. The post card only ever shows ONE image and NEVER shows video (real data is being thrown away)

The DB row has `image_urls: string[]` and `video_url: string | null`
(`lib/supabase/types.ts:67-68`). The composer uploads up to 5 images OR one video
(`PostComposer.tsx:177-189`) and `createPost` persists both fields
(`lib/db/posts.ts:148-150`). But the mapper collapses all of it:

- `lib/ui/toCardPost.ts:33` -> `image: p.image_urls?.[0]` - images 2..5 are silently dropped.
- `lib/ui/toCardPost.ts` has **no `video` field at all**. The `Post` interface in
  `PostCard.tsx:83-105` has no `video` field either. So a post with a video uploads
  fine, costs the user bandwidth, and then renders as a **blank card with no media**
  in the feed. The video is only visible if you click through to `/p/[short_id]`
  (`app/p/[short_id]/page.tsx:89-93`).

This is the single biggest "fake/dead" problem in the area: a feature that exists end
to end (upload, store, detail view) but is **invisible in the feed**, which is where
99% of views happen. A multi-image post looks identical to a single-image post.

### 1b. Feed avatars are always initials - the real avatar is dropped

`PostAuthor` carries `avatar_url` (`lib/db/posts.ts:8`) and the detail page uses it
(`app/p/[short_id]/page.tsx:55` passes `src={post.author.avatar_url}`). But:

- `lib/ui/toCardPost.ts:21-26` builds `author` with only `name / handle / college` -
  **`avatar_url` is never copied**.
- `PostCard.tsx:380` and `:384` render `<Avatar name={...} />` with **no `src`**.

Result: every face in the entire feed is a grey initials chip even when the user has a
real photo. LinkedIn/Instagram/X are all photo-first; we are throwing away the one
asset that makes a feed feel human.

### 1c. Every like / save / react / repost triggers a full-page server refetch (the ~1s lag)

The card does optimistic local state correctly (`PostCard.tsx:146-212`), but the server
actions it calls all end with `revalidatePath("/home")`:

- `app/(app)/home/engagement-actions.ts:15, 22, 27, 37, 49, 56, 62, 68`
  (`likePostAction`, `reactToPostAction`, `unlikePostAction`, `bookmarkPostAction`,
  `repostPostAction`, etc).

`revalidatePath("/home")` invalidates the cache for `/home`, and because the page is
`export const dynamic = "force-dynamic"` (`app/(app)/home/page.tsx:22`) the **entire
feed (4 feed queries + engagement + suggested + news + ranker) re-runs and the whole
RSC payload streams back** after every tap. That is exactly the "~1s to register an
action" the founder is feeling: the optimistic paint is instant, but a heavy refetch
fires behind it and can clobber state / cause a visible reflow. A single like should
touch nothing but that one row.

### 1d. A new post does NOT appear instantly (no optimistic insert)

`createPostAction` (`app/(app)/home/actions.ts:121`) calls `revalidatePath("/home")` on
success. The composer (`PostComposer.tsx:204-209`) just resets its form on `ok`. There
is **no client state for the feed** - `HomeFeed` receives its posts as server props
(`HomeFeed.tsx:20`, fed from `page.tsx:213-219`). So after you hit Post you wait for the
full server round-trip + re-render before your post shows up at the top. Instagram/X
slot the new post in immediately with a "Posting..." shimmer; we make the user wait.

### 1e. The composer UI is bare ("fuck all")

`PostComposer.tsx` works but is visually thin:

- **Image previews are a row of fixed 80px (`size-20`) squares** (`:288`) - they don't
  show aspect ratio, can't be reordered, have no captions, no count, no "drag to add".
  Five images render as five tiny equal squares, nothing like the IG/X mosaic.
- **Video "preview" is just a filename pill** (`:308-316`) - `Video` icon + truncated
  filename + X. There is **no actual `<video>` thumbnail**, no duration readout, no
  poster. The user can't tell what they're about to post.
- **The hashtag input is a 16-20px-wide box** (`PostComposer.tsx:365`,
  `className="w-16 ... sm:w-20"`) sitting inline in the action row. It's cramped, easy
  to miss, and there is no tag autocomplete/suggestion despite the app having trending
  hashtags (`page.tsx:62-72`) and a ranker.
- **No expand-on-focus** - the textarea is a static 3-row box (`:242`). Real composers
  start compact and grow / open a focused sheet.
- **No drag-and-drop or paste-to-upload** - desktop users expect to drag an image in or
  paste a screenshot from the clipboard. Neither is wired.
- **Mutually-exclusive media is enforced by disabling buttons** (`:334, :346`) with no
  explanation - the Photo button just goes dim once a video is attached. No tooltip
  copy tells the user why.
- **No link preview / no project attach** even though `createPost` supports
  `project_id` (`lib/db/posts.ts:116`) and posts are full of URLs.

### 1f. Post card is a "one-line blog + hashtag", not a rich social card

`PostCard.tsx` is competent but reads as text-first:

- Body, then tags, then (maybe) one cover image in a fixed `aspect-video` crop
  (`:484-496`). Tall portrait images and screenshots get center-cropped and lose info.
- **No reaction summary / social proof.** We store 6 reaction kinds
  (`lib/db/engagement.ts:9`) and `repost_count` / `bookmark_count` exist on the row
  (`types.ts:79-80`), but the card shows only a bare like number and comment number. No
  "Aarav and 12 others", no stacked reaction emojis, no repost count. LinkedIn/X lead
  with that social proof.
- **No "see more" truncation.** Long bodies render in full (`:457`) with
  `whitespace-pre-line`, so one rambling post can be a screen tall and push everything
  down. IG/LinkedIn clamp to ~3 lines with a "...more".
- **No timestamps on hover / no absolute time.** Only relative "2h" (`:412`).
- The whole card body is **not** a single click target; only the image and the body
  paragraph link to the post, the tag area / whitespace do nothing.

### 1g. CONTRAST offenders (verified file:line)

- **Pinned tint is invisible:** `PostCard.tsx:350` uses `bg-saffron/2` (2% opacity of
  `#2C5BFF` over white) - effectively #FAFBFF, indistinguishable from `bg-paper`. The
  "pinned" state has no visible background.
- **Separator dots use `text-bone`:** `PostCard.tsx:407, 411, 707, 710` render the
  `&middot;` dividers in `text-bone` (#DDE3EE). On `bg-paper` (#fff) that is ~1.2:1
  contrast - the dots are barely there. Borders are fine in bone; *text* in bone is not.
- **Reaction colours are off-palette:** `PostCard.tsx:61-65` uses raw Tailwind
  `text-amber-500 / text-rose-400 / text-red-500 / text-blue-400 / text-green-500` -
  none are brand tokens, and `text-rose-400` / `text-blue-400` are low-saturation and
  read as muddy against cream. They also clash with the cobalt brand.
- Empty hashtag input placeholder "tag" in `text-ash` inside a `bg-cream` box is on the
  edge of acceptable but combined with the 16px width it's near-invisible.

### 1h. What is already GOOD (keep it)

- Client-side direct-to-Storage upload with HEIC->JPEG + compression
  (`PostComposer.tsx:36-46`, `lib/media/compress.ts`) - keep this whole pipeline.
- Optimistic like/react/save/repost local state in the card (`PostCard.tsx:146-251`) -
  the pattern is right, it's only the server actions behind it that over-revalidate.
- Reaction picker popover with hover-intent + click caret (`PostCard.tsx:513-594`) -
  good interaction, keep.
- Repost embedded-original card (`PostCard.tsx:682-755`) - solid, keep + reuse.
- The detail page already renders all images in a grid and the video
  (`app/p/[short_id]/page.tsx:80-93`) - the feed just needs to catch up.

---

## 2. TARGET (world-class + 100% real)

Reference points: **Instagram** (media-first card, multi-image carousel, double-tap to
like, square/portrait/landscape aware), **LinkedIn** (rich author block, reaction
summary "X and N others", 3-line clamp + "see more", document/media cards), **X**
(instant optimistic post insert, compact engagement row, inline media grid 1-4),
**Notion** (clean composer that grows, paste/drag to add media).

### Composer target
- A compact entry that **expands on focus** into a full composer (textarea grows,
  toolbar reveals, optional focused modal on mobile).
- **Real media tray**: a responsive grid of previews that respects each file's aspect
  ratio; videos show a **real `<video>` first-frame thumbnail with a duration badge and
  play glyph**; per-item remove + reorder; a live "3 / 5 photos" counter.
- **Drag-and-drop + paste** anywhere on the composer to add images.
- **Hashtag UX** as proper chips with an **autocomplete menu** sourced from the same
  trending tags the home page already computes, plus inline `#tag` detection in the body.
- Inline, honest validation (mutually-exclusive media explained in words, size/length
  shown live).
- **Optimistic post**: on submit, the post appears at the top of the feed instantly with
  a subtle "Posting..." state, then confirms or rolls back.

### Post card target
- **Media-first when media exists**: render the real `image_urls` grid (1 = full-bleed
  respecting aspect ratio up to a max; 2 = side by side; 3 = 1 big + 2 stacked; 4+ = 2x2
  with a "+N" tile) and **render `video_url` as an inline, click-to-play `<video>` with
  poster + duration**. This is the headline fix.
- **Real avatars** (pass `avatar_url`).
- **Reaction summary row**: stacked reaction glyphs + "Aarav and 12 others" using the
  real counts, with reposts/bookmarks counts where > 0.
- **3-line body clamp + "see more"** that expands in place (no navigation).
- **Double-tap / double-click image to like** (IG behaviour) with a heart burst, fully
  optimistic.
- Brand-correct reaction colours, visible pinned state, visible separators.
- One canonical card used by feed; the detail page action bar reuses the same engagement
  hook so behaviour can't drift.

### Performance target
- A **single like/save/react/repost mutates exactly one post's counters** and never
  refetches the feed. Optimistic UI is the source of truth; the server call only
  persists. Remove `revalidatePath("/home")` from engagement actions.
- A **new post is inserted into a client feed store optimistically**; the only
  server refetch is a quiet background reconcile, not a blocking full re-render.

---

## 3. STEP-BY-STEP PLAN (ordered, concrete)

### Phase A - Make media REAL in the feed (highest impact, lowest risk)

**A1. Carry all media + avatar through the mapper.**
File: `lib/ui/toCardPost.ts`
- Change `image: p.image_urls?.[0]` to `images: p.image_urls ?? []` (keep a back-compat
  `image` getter if needed, but prefer migrating callers).
- Add `video: p.video_url ?? null`.
- Add `avatar_url: p.author?.avatar_url ?? null` into the `author` object.
- Add `reposts: p.repost_count ?? 0` and `saves` (already present) to `stats`.
- Mirror the same for the embedded `repostOf` block (`toCardPost.ts:39-58`): add
  `images`, `video`, `author.avatar_url`.

**A2. Extend the `Post` / `EmbeddedOriginal` interfaces.**
File: `components/composite/PostCard.tsx:73-105`
- `author`: add `avatar_url?: string | null`.
- Replace `image?: string` with `images?: string[]` and add `video?: string | null`.
- `stats`: add `reposts: number`.

**A3. Build a `<PostMedia>` sub-component (new).**
File: `components/composite/post/PostMedia.tsx` (new)
- Props: `images: string[]`, `video: string | null`, `shortId`, `onDoubleLike?`.
- Layout rules (Instagram/X grade):
  - `video` present -> render inline `<video controls preload="metadata" poster>` in a
    rounded `border-bone` frame; tapping the poster plays. Duration badge bottom-right.
  - 1 image -> full-width, `max-h-[32rem]`, `object-contain` on a `bg-ink/[0.03]` mat so
    portraits/screenshots aren't cropped (IG behaviour); rounded `border-bone`.
  - 2 -> 2-col grid, equal squares.
  - 3 -> first image tall on the left (row-span-2), two stacked right.
  - 4+ -> 2x2 grid, 4th tile shows a dimmed `+N` overlay linking to the post.
  - Each tile is a `<Link href={/p/${shortId}}>` (the lightbox can come later; for now
    click opens the post). Add `loading="lazy"` + explicit width/height to avoid CLS.
- Use this component in BOTH the main card and the embedded original card, replacing the
  single-image blocks at `PostCard.tsx:484-496` and `:733-738`.

**A4. Pass real avatars.**
File: `components/composite/PostCard.tsx:380, 384, 698`
- Add `src={post.author.avatar_url ?? undefined}` to each `<Avatar>`.

Result after Phase A: every existing post with multiple images or a video renders
correctly in the feed with real faces. No DB change, no migration. Ship this first.

### Phase B - Kill the perceived latency (perf)

**B1. Stop full-feed revalidation on engagement.**
File: `app/(app)/home/engagement-actions.ts`
- Remove `revalidatePath("/home")` from `likePostAction`, `unlikePostAction`,
  `reactToPostAction`, `bookmarkPostAction`, `unbookmarkPostAction`, `repostPostAction`
  (lines 15, 22, 27, 49, 56, 62, 68). The card already updates counts optimistically;
  the DB row is the only thing that needs to change. Keep `addCommentAction` /
  `deleteCommentAction` revalidation as-is for now (or scope them to the detail route),
  since comment counts surface in multiple places - revisit in the comments plan.
- Same change for the detail-page versions if they import the same actions (they do -
  `PostDetailActions.tsx:20-27`), so this also speeds up the detail page.

**B2. Repost should optimistically insert, not blocking-refetch.**
`repostPostAction` creates a real new post. After removing the revalidate, the card
shows the "Reposted" toast (`PostCard.tsx:245`) which is enough feedback; the new repost
will appear on next natural feed load. (Optionally, in Phase C, push it into the client
store too.)

**B3. (Optional, recommended) Light client cache for engagement.**
Add `lib/client/engagement-store.ts` - a tiny module-level `Map<postId, {liked,
reaction, saved, likes}>` that the card reads on mount and writes on every optimistic
change, so navigating away and back (or rendering the same post in two tabs) keeps the
user's reaction without waiting for the server. This is the "client cache" requirement
for this area and avoids the like flicker when the feed reorders.

### Phase C - World-class composer

**C1. Refactor `PostComposer` into composer + media-tray + tag-field.**
New files:
- `components/composite/composer/MediaTray.tsx` - the responsive preview grid (mirrors
  `PostMedia` layout rules) with per-item remove, drag-reorder (HTML5 DnD or
  `@dnd-kit` if already present; otherwise simple up/down), and **real video thumbnail**:
  set the `<video>` `src` to the object URL, `preload="metadata"`, show first frame; add
  a duration badge by reading `video.duration` (already read at
  `PostComposer.tsx:117-126` - reuse that metadata load).
- `components/composite/composer/HashtagField.tsx` - chip input with an autocomplete
  dropdown. Accept a `suggestions: string[]` prop (trending tags) and filter as the user
  types; Enter/Space/comma commits; Backspace deletes last chip (keep logic from
  `PostComposer.tsx:136-151`). Make the input full-width on its own row, not a 16px box.

**C2. Expand-on-focus + drag/paste.**
File: `components/composite/PostComposer.tsx`
- Start the textarea at `rows={2}`; on focus, grow to `rows={4}` and reveal the toolbar
  (it's currently always shown - that's fine, but the expansion makes the resting state
  calmer).
- Add `onDragOver`/`onDrop` on the form root and `onPaste` on the textarea to accept
  image files; route them through the existing `handleImageChange` logic (extract a
  shared `addImageFiles(files)` from `:80-91`).
- Add a visible "Photos / Video" affordance with the live counter "{n}/5".
- Replace the inline hashtag box (`:355-367`) with `<HashtagField suggestions={...} />`
  on its own line above the action row.

**C3. Wire trending tag suggestions (real, not fake).**
File: `app/(app)/home/page.tsx`
- It already computes `trending` (top tags, `page.tsx:62-72`). Pass
  `suggestedTags={trending.map(t => t.tag)}` into `<PostComposer .../>` (`:201`) and
  forward to `HashtagField`. This reuses the same relevance signal the rest of the plan
  references, with zero new queries.

**C4. Auto-detect inline `#tags` in the body** (optional, IG/X behaviour): parse `#word`
tokens out of `body` on submit and merge with the chips so users who type tags inline
still get them. Pure client logic in the submit handler (`PostComposer.tsx:198-202`).

### Phase D - World-class post card

**D1. Reaction summary + counts row (new sub-component).**
File: `components/composite/post/ReactionSummary.tsx` (new)
- Renders stacked reaction glyphs for the kinds present + "{topActor} and N others" when
  counts allow. For now we only reliably have aggregate `like_count`; show
  `{likes} reactions` with the stacked default glyphs, and add a `· {reposts} reposts`
  / `· {saves} saved` when > 0. Insert above the action bar (`PostCard.tsx:510`).
- Honest: if we don't have per-kind breakdown yet, show the total honestly rather than
  fabricating "Aarav and 12 others". See Open Questions D-2 for adding the breakdown.

**D2. Body clamp + "see more".**
File: `components/composite/PostCard.tsx:455-461`
- Wrap the body in a clamp (`line-clamp-3` until expanded) with a "see more" button that
  flips local `expanded` state (no navigation, no fetch). Keep the body itself clickable
  to the post only on the media/`see more` is a button, so clicks don't fight.

**D3. Double-tap/double-click to like.**
- Pass `onDoubleLike={() => { if (!liked) toggleLike(); showHeartBurst(); }}` into
  `<PostMedia>`. Heart-burst is a short Motion `scale/opacity` overlay; respects
  `useReducedMotion` (already imported in `HomeFeed.tsx:4`).

**D4. Fix contrast + brand colours.**
File: `components/composite/PostCard.tsx`
- `:350` `bg-saffron/2` -> `bg-saffron/[0.06]` plus a left accent `border-l-2
  border-saffron` so "pinned" is actually visible.
- Separator dots `:407, :411, :707, :710` `text-bone` -> `text-ash/60` (or just use a
  `gap` + no dot). Bone is fine for *borders*, not for glyphs.
- Reaction palette `:60-65`: move to brand-aligned tokens -
  like -> `text-saffron`, love -> `text-ember`, support -> `text-moss`,
  celebrate -> `text-gold`, insightful -> `text-saffron-dk`, funny -> `text-gold`.
  Keep them distinct but on-brand and high-contrast against paper/cream.

**D5. Make the card body a cleaner click target.**
- Keep author links and media links as-is; wrap the non-interactive whitespace of the
  body region in a single `Link` to `/p/[short_id]` so clicking dead space opens the
  post (X/LinkedIn behaviour), while buttons/links stop propagation.

### Phase E - Optimistic new-post insert (client feed store)

**E1. Lift the feed into client state.**
File: `components/composite/HomeFeed.tsx`
- Seed `useState` from the server props (`forYou/recent/...`), render from state.
- Expose an `addOptimisticPost(card)` via context or a callback passed up to the page,
  or co-locate the composer inside a new `FeedClient` wrapper that owns both the composer
  and `HomeFeed` so they share state.

**E2. Composer inserts optimistically.**
File: `components/composite/PostComposer.tsx` + new `FeedClient.tsx`
- On submit, before/while the action runs, build a `CardPost` from the local body +
  uploaded URLs + the current user's profile (name/handle/avatar) and unshift it into the
  "For you" + "Recent" lists with a `pending: true` flag (renders at reduced opacity +
  "Posting...").
- On `action` success, replace the optimistic card's id/short_id with the real
  `{postId, shortId}` already returned by `createPostAction`
  (`app/(app)/home/actions.ts:60` returns them) - no extra query needed.
- On failure, remove the optimistic card and surface the existing `serverError`.
- Drop `revalidatePath("/home")` from `createPostAction` (or keep it as a low-priority
  background reconcile only - test that it doesn't clobber the optimistic list).

### DB tables / columns / migrations

- **None required for Phases A-E core.** Every field used (`image_urls`, `video_url`,
  `avatar_url`, `like_count`, `comment_count`, `repost_count`, `bookmark_count`) already
  exists on `posts` / `profiles` (`lib/supabase/types.ts:62-86`, `lib/db/posts.ts:8`).
- **Optional (D-2 reaction breakdown):** to show real "Aarav and N others", add a SQL
  view or RPC `post_reaction_summary(post_id)` returning the top reactor's name + a
  per-kind count, derived from the existing `reactions` table. No schema change to base
  tables; just an aggregate read. Defer until the founder confirms they want named social
  proof.

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

- **Likes/reactions/saves/reposts:** keep the optimistic local state in the card
  (`PostCard.tsx:146-251`) but **remove `revalidatePath("/home")`** from the six
  engagement actions (`engagement-actions.ts`) so a tap mutates one row and nothing
  refetches. This is the direct fix for the "~1s to register" complaint - right now the
  optimistic paint is instant but a full feed refetch fires behind it.
- **New post:** insert into a client feed store immediately with a "Posting..." state
  (Phase E); reconcile in the background, never block on a full server re-render.
- **Client cache:** module-level engagement store (B3) so reactions survive feed reorders
  and navigation without a server round-trip.
- **Media perf:** `loading="lazy"` + explicit dimensions on every feed image to kill CLS;
  `preload="metadata"` (not `auto`) on feed videos so the feed doesn't download full
  videos; only the clicked video streams. Keep client-side compression
  (`lib/media/compress.ts`) - it already caps images at ~1MB/1600px.
- **Composer:** object URLs are already revoked on reset (`PostComposer.tsx:65-77`);
  ensure the new MediaTray revokes on per-item remove too (it does at `:95`) and on
  unmount.

---

## 5. HONESTY + CONTRAST NOTES

- **Dead/invisible feature made real:** multi-image + video in the feed (Phase A). Today
  the upload is real but the render throws it away - this is the most "fake-feeling"
  part of the experience and Phase A makes it honest.
- **No avatars -> real avatars** (A4): we already store the photo; show it.
- **No fabricated social proof:** the reaction summary (D1) must use real counts. Until a
  per-kind/named breakdown exists (Open Question D-2), show honest totals
  ("{n} reactions"), never invented names.
- **Contrast fixes (all real offenders):**
  - `PostCard.tsx:350` `bg-saffron/2` invisible pinned tint -> `bg-saffron/[0.06]` + left
    accent border.
  - `PostCard.tsx:407, 411, 707, 710` separator dots in `text-bone` (1.2:1) ->
    `text-ash/60`.
  - `PostCard.tsx:60-65` off-brand low-contrast reaction colours -> brand tokens
    (saffron/ember/moss/gold/saffron-dk).
  - Composer hashtag field 16px width + faint placeholder -> full-width field with
    visible label/affordance (C1).
- **No em dashes, no Hindi-only text, honest company facts** - the area has no copy that
  violates this today; new empty-states/labels must follow it (use "and" / "-", India
  for location).

---

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. **Carousel vs grid for multi-image:** Instagram uses a swipeable single-frame
   carousel; X/LinkedIn use a static 1-4 grid. Grid is simpler and matches the detail
   page. Do you want a swipeable carousel in the feed, or the static grid (recommended
   for v1)?
2. **Named reaction social proof ("Aarav and 12 others"):** do you want this? It needs a
   small aggregate read/RPC over the `reactions` table (no schema change). If not, we show
   honest totals only.
3. **Double-tap-to-like on images:** confirm you want IG-style double-tap (with heart
   burst). It can occasionally conflict with double-tap-to-zoom on mobile - acceptable?
4. **Mutually-exclusive media:** keep "images OR one video per post" (current rule,
   enforced at `actions.ts:107`), or allow mixed media? Staying single-type is simpler and
   matches the current backend.
5. **Composer surface on mobile:** inline expand (stays on the home page) vs a full-screen
   composer sheet (like X's compose modal). Inline is less work; the sheet feels more
   premium. Preference?
6. **`revalidatePath` on comments:** comment counts appear on cards and the detail page.
   I'm leaving comment-add/delete revalidation in place for now to avoid stale counts -
   confirm that's fine, or we move comments fully optimistic in the comments plan.
7. **Drag-reorder of composer images:** worth the effort for v1, or is add/remove enough?
