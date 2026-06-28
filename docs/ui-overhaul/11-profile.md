# 11 - Profile Overhaul (Banners, Contrast, Profile Score, Real Tabs)

Area owner files (all read for this plan):
- `app/(app)/profile/page.tsx` (owner profile, server)
- `app/(app)/profile/edit/page.tsx` + `app/(app)/profile/edit/actions.ts`
- `app/u/[handle]/page.tsx` (public/visitor profile, server)
- `components/composite/ProfileTabs.tsx`
- `components/composite/ProfileEditForm.tsx`
- `components/composite/ProfileActions.tsx`
- `components/primitives/Avatar.tsx`
- `lib/db/profiles.ts`, `lib/db/posts.ts`, `lib/supabase/types.ts`
- `supabase/migrations/0001_init.sql` (profiles table), `0006_profile_settings.sql`, `0007_storage_policies.sql`

Latest migration on disk is `0026_neural_ranker.sql`, so new migrations start at `0027`.

---

## 1. CURRENT STATE (what exists, what is broken / dead / fake)

### 1a. Cover system today is upload-only and the two profile pages disagree
- Owner profile cover: `app/(app)/profile/page.tsx:65-101`. If `p.cover_url` exists it renders a raw `<img ... object-cover>` with NO position control (it always shows the vertical center). Otherwise it renders a hard-coded brand gradient + SVG noise + cobalt glow.
- Public profile cover: `app/u/[handle]/page.tsx:142-152`. This page **ignores `cover_url` entirely** - it always renders a single fixed dark gradient `bg-[linear-gradient(135deg,#0B1220_0%,#0A0F1C_100%)]`. So a user who uploads a cover sees it on their own profile but **visitors never see it.** That is a real inconsistency/dead path.
- There is **no preset banner system anywhere** (confirmed: no `banner`/`preset`/`focal` references in `lib`/`app`/`components`). The only "banner" hits are unrelated UI banners in messages/collab pages.
- Upload path: `ProfileEditForm.tsx:84-103,131-134` uploads the cover client-side to the `covers` bucket via `prepareImageForUpload` (compresses to ~1 MB / 1600px, `lib/media/compress.ts:50-56`) and stores the public URL in `cover_url`. There is **no drag-to-reposition** - whatever the user uploads is shown center-cropped on the owner page and not at all on the public page.
- Storage + column already exist: `cover_url text` (`0001_init.sql:16`), `covers` bucket policies (`0007_storage_policies.sql:11,22-27`). No `cover_focal_*` or `banner_preset` columns exist yet.

### 1b. CONTRAST BUG IS REAL: the name blends into the cover
- Owner page: the avatar+name block uses a negative top margin (`-mt-14 ... md:-mt-24`, `profile/page.tsx:109`) so the `<h1>` (`text-ink` = #0A0F1C, `profile/page.tsx:132-137`) sits visually **on top of the cover band**. With the default dark gradient cover, near-black ink text over a near-black cover is effectively invisible. With a user-uploaded photo the name lands on arbitrary pixels (could be dark sky, a face, anything) - there is **no scrim, no overlay, no guaranteed-contrast treatment**. This is the "name going invisible into the banner" the brief calls out.
- Public page has the same structure (`app/u/[handle]/page.tsx:155-160`): `-mt-14 ... md:-mt-20` pulls the `text-ink` name up over the dark cover. Same invisibility risk.
- Secondary low-contrast offenders found:
  - `profile/page.tsx:160` "`text-bone`" used for the middot separators between college/branch/year. `bone` (#DDE3EE) on cream (#F5F7FB) is ~1.1:1 - effectively invisible. Same `text-bone` middot at `ProfileTabs.tsx:152,271`.
  - `ProfileTabs.tsx:560` "No bio added yet." rendered in `text-bone` on `paper` - far below 4.5:1.
  - `ProfileEditForm.tsx:247` disabled handle input uses `text-ash` on `bg-cream`; acceptable but borderline, and the field looks "broken" rather than intentionally locked.

### 1c. PROFILE SCORE leak risk - currently OK, but fragile
- The "Profile score" is computed only in the owner page (`profile/page.tsx:46-48,213`) as `% of {name,bio,college,branch,city,avatar_url} filled`, shown in the stats strip. The public `/u/[handle]` page does **not** render any score (confirmed: no `score` reference in that file). So today it is correctly owner-only **by accident** (two separate pages), not by an enforced rule. There is no shared component guarding it, so any future refactor that unifies the pages would leak it. The brief wants this guaranteed owner-only.
- The score itself is a real, honest derived metric (not fake), but it is shallow: it ignores links, year_of_study, headline, verified, and post activity. It is fine to keep but should be made more meaningful and turned into actionable "complete your profile" nudges (LinkedIn-style), not just a number.

### 1d. Tabs: mostly real, but Highlights is half-dead and Projects differs by page
- **Posts tab** (`ProfileTabs.tsx:417-436`): REAL. Renders `getProfilePosts(profile.id, 24)` (`lib/db/posts.ts:88-100`), owner can delete via `deletePostAction` (`ProfileTabs.tsx:199-203`). Good.
- **Projects tab** (owner): REAL. Owner page queries `projects` where `author_id = me` (`profile/page.tsx:38-43`) and passes them in. The public page does **not** show this Projects tab at all - it instead shows "Verified contributions" (`getVerifiedProjectsForUser`, `app/u/[handle]/page.tsx:128-132,281-342`). So owner sees "projects I authored", visitors see "verified contributions" - two different concepts under different headings. Confusing but both real.
- **Highlights tab** (`ProfileTabs.tsx:470-541`): PARTIALLY DEAD. It filters `posts.filter(p => p.is_pinned || p.is_highlight)` (`ProfileTabs.tsx:356`). `is_pinned` is real and toggleable from `PostCard` (`pinPostAction`/`unpinPostAction`). But `is_highlight` is **only ever set by `convertRepostToHighlight`** (`lib/db/posts.ts:280-283`) which fires **only for reposts**. There is no general "add to highlights" affordance for normal posts, no curation, no reorder, and no per-highlight cover/title - so the Instagram-style "Highlights" promise is mostly unfulfilled. The story bubbles (`HighlightBubble`, `ProfileTabs.tsx:51-98`) just reuse pinned/highlight posts and label every one "Pinned" or "Highlight" - there is no real highlight *collection* concept.
- **About tab** (`ProfileTabs.tsx:546-611`): REAL but thin (bio + college/branch chips). Does not surface city, year, links, account_type, or interests that already exist on the profile.

### 1e. Public profile has no tabs/stats at all (asymmetry)
- `/u/[handle]` is a flat scroll: cover -> identity -> "Recent posts" list -> "Verified contributions". No tab bar, no stats (connections/posts/projects), no Highlights, no About. Compared to LinkedIn/X/Instagram public profiles this feels unfinished and gives visitors much less than the owner sees of themselves.

### 1f. Perceived latency / no optimistic UI on this surface
- Both profile pages are `force-dynamic` server components (`profile/page.tsx:16`, and `/u/[handle]` is async server). Every visit is a fresh server round-trip with `Promise.all` of 3-4 queries. Saving the profile does a full server action + `redirect("/profile")` (`edit/actions.ts:51-53`) so edits feel like a page reload, not an instant update.
- `ProfileActions` (Follow/Connect/Message) IS already optimistic (`ProfileActions.tsx:40-74`) - good reference. But the **edit -> save -> see new banner/name** loop is not optimistic at all.
- The cover `<img>` and post `<img>` use raw `<img>` (no `next/image`, no priority, no blur placeholder), so the cover paints late and pops in.

---

## 2. TARGET (world-class + 100% real)

Reference systems: **LinkedIn** (cover + reposition + headline + "profile strength" meter shown only to you), **Instagram** (highlight collections with custom covers), **X/Twitter** (banner with a legible scrim behind the name), **Notion** (preset gradient/doodle covers + drag-to-reposition).

1. **Banner system (real, zero-asset).** 18 CSS/SVG-generated presets in 4 families - Gradients, Doodles, Abstract, Scenic - rendered from pure CSS gradients + inline SVG (always crisp, no network cost). User picks a preset **or** uploads their own (<=1 MB) cover. Uploaded covers get **Notion-style drag-to-reposition** (choose the focal point that shows). Banner state is one of: a preset id (`banner_preset`) OR an uploaded `cover_url` + focal offsets (`cover_focal_x`, `cover_focal_y`). Owner and public pages render the **same** banner component so what the owner sets is exactly what visitors see.
2. **Guaranteed-legible name.** A standardized scrim/treatment: the name and identity row sit inside a bottom-anchored gradient scrim over the banner (X-style), or on a solid `paper` "identity card" that overlaps the banner (LinkedIn-style). Either way text contrast is guaranteed >= 4.5:1 regardless of the banner pixels. We choose the **identity card** approach (cleanest with the editorial brand) with a scrim as the fallback for the on-banner avatar.
3. **Profile score = owner-only "Profile strength".** A real, richer completeness score with a checklist of missing items and deep links to fix each. Enforced owner-only via an explicit `isOwner` prop on a shared component, never rendered on the visitor path.
4. **Real, symmetrical tabs on both pages.** Posts / Projects / Highlights / About all real and present on owner AND visitor views (visitor sees the same tabs, minus owner-only controls like delete and minus the score). Highlights becomes a real curated collection.
5. **Optimistic + cached.** Banner picker updates instantly; profile edits reflect optimistically; navigation between `/profile`, `/u/[handle]`, and tabs feels instant.

---

## 3. STEP-BY-STEP PLAN

### Step 0 - DB migration: banner fields + highlight collections
New file `supabase/migrations/0027_profile_banners_highlights.sql`.

```sql
-- Banner: a preset id OR an uploaded cover with a focal point.
alter table public.profiles
  add column if not exists banner_preset  text,                       -- e.g. 'cobalt-aurora'; null when using an upload
  add column if not exists cover_focal_x  smallint not null default 50, -- 0..100, % from left
  add column if not exists cover_focal_y  smallint not null default 50; -- 0..100, % from top

-- Real highlight collections (Instagram-style), owner-curated.
create table if not exists public.profile_highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 40),
  cover_kind  text not null default 'preset' check (cover_kind in ('preset','post_image')),
  cover_ref   text,                       -- preset id, or a post image url
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_highlights_user on public.profile_highlights (user_id, sort_order);

create table if not exists public.profile_highlight_items (
  highlight_id uuid not null references public.profile_highlights(id) on delete cascade,
  post_id      uuid not null references public.posts(id) on delete cascade,
  sort_order   int not null default 0,
  primary key (highlight_id, post_id)
);
```
RLS (mirror existing patterns in `0002_rls.sql`): public `select` on both highlight tables; `insert/update/delete` only `using (user_id = auth.uid())` (and for items, only when the parent highlight belongs to the caller). Keep `is_pinned`/`is_highlight` on posts as-is for backward compatibility, but new curation lives in these tables.

Update `lib/supabase/types.ts`:
- Add to `Profile`: `banner_preset: string | null; cover_focal_x: number; cover_focal_y: number;`
- Add interfaces `ProfileHighlight` and `ProfileHighlightItem`.

### Step 1 - Banner preset registry (NEW `lib/profile/banners.ts`)
A single source of truth, zero network cost. Each preset is a function returning a React style/JSX layer.

```ts
export type BannerFamily = "gradient" | "doodle" | "abstract" | "scenic";
export interface BannerPreset {
  id: string;            // 'cobalt-aurora'
  family: BannerFamily;
  label: string;         // 'Cobalt Aurora'
  /** Inline background CSS (gradients) OR a render() for SVG-layered presets. */
  css?: React.CSSProperties;
  render?: () => React.ReactNode; // inline <svg> for doodle/abstract/scenic
}
export const BANNER_PRESETS: BannerPreset[] = [ /* 18 entries */ ];
export const DEFAULT_BANNER = "cobalt-aurora";
export function getBanner(id: string | null): BannerPreset { /* lookup w/ default */ }
```
- 18 presets, all brand-aligned (cobalt `#2C5BFF`, ink `#0A0F1C`, gold `#F5A623` accents):
  - Gradients (5): cobalt-aurora, midnight-mesh, dawn-cobalt, ink-fade, paper-cobalt-soft.
  - Doodles (4): inline `<svg>` patterns (plus marks, circuit lines, sketch nodes, constellation) tinted on a base gradient.
  - Abstract (5): conic/radial mesh blends, blueprint grid, soft blobs, halftone dots, diagonal bands.
  - Scenic (4): pure-CSS layered "horizon/skyline/wave/aurora" using stacked gradients (no photos).
- All use `currentColor`/token hexes so they stay crisp at any width and cost zero bytes.

### Step 2 - Shared `<ProfileBanner>` component (NEW `components/composite/ProfileBanner.tsx`)
Single component used by BOTH `/profile` and `/u/[handle]` so owner==visitor.

Props: `{ coverUrl?: string | null; bannerPreset?: string | null; focalX?: number; focalY?: number; className?: string }`.
Render logic:
- If `coverUrl` present -> `<img>` with `style={{ objectPosition: \`${focalX}% ${focalY}%\` }}` and `object-cover`. (This is the reposition fix - `objectPosition` is exactly how Notion/LinkedIn render a chosen focal point.)
- Else -> render `getBanner(bannerPreset)`: apply `css` as background and/or `render()` SVG layer.
- **Always** render the contrast scrim layer on top: a bottom-anchored gradient `linear-gradient(to top, rgba(10,15,28,0.55) 0%, rgba(10,15,28,0.15) 35%, transparent 70%)` so anything sitting on the lower band of the banner (avatar, optional on-banner text) stays legible. This guarantees contrast for case 1b.

Replace owner cover block `profile/page.tsx:65-101` with `<ProfileBanner coverUrl={p.cover_url} bannerPreset={p.banner_preset} focalX={p.cover_focal_x} focalY={p.cover_focal_y} />`.
Replace public cover block `app/u/[handle]/page.tsx:142-152` with the **same** component fed from `profile.*`. This fixes the dead public-cover path (1a) in one move.

### Step 3 - Fix the invisible-name contrast (the core 1b fix)
Adopt the **LinkedIn identity-card** pattern so the name never sits on raw banner pixels:
- Keep the avatar overlapping the banner (it has its own ring/scrim and is image, not text).
- Move the name + headline OUT of the negative-margin overlap and into a solid `bg-paper` identity card that starts just below the banner. Concretely in `profile/page.tsx:130-188` and `app/u/[handle]/page.tsx:158-196`, wrap the identity block in `rounded-2xl border border-bone bg-paper px-5 py-5 shadow-sm` and only let the **avatar** (not the text) use the `-mt` overlap.
- Result: `text-ink` name on `bg-paper` = ~16:1 contrast, guaranteed, on every banner.
- For the avatar over banner, keep the existing white ring (`boxShadow: 0 0 0 3px #F5F7FB`, `profile/page.tsx:118`) plus the Step 2 scrim.
- Replace every `text-bone` used as *content/text* with `text-ash` (or a real separator dot element): `profile/page.tsx:160`, `ProfileTabs.tsx:152,271,560`. `text-bone` may remain only for actual 1px borders/decorative dots, never for readable glyphs.

### Step 4 - Banner picker in the edit flow (`ProfileEditForm.tsx`)
Replace the single "Cover photo" upload block (`ProfileEditForm.tsx:156-183`) with a `<BannerEditor>` (NEW `components/composite/BannerEditor.tsx`, client):
- Tabbed: **Presets** | **Upload**.
- Presets: a responsive grid of 18 live `<ProfileBanner>` thumbnails (each ~16:5). Click selects; selected gets a cobalt ring. Sets hidden input `banner_preset`, clears `cover_url`.
- Upload: existing `prepareImageForUpload` flow (<=1 MB, `compress.ts`). After upload, show a **drag-to-reposition** stage: render the cover in a fixed-aspect frame (`h-40 sm:h-52`) and let the user drag vertically/horizontally; on drag, update `focalX`/`focalY` (0..100) and apply live via `objectPosition`. Persist into hidden inputs `cover_focal_x`/`cover_focal_y`. (Pointer math: `focal = clamp(round((pointer - rectStart) / rectSize * 100), 0, 100)`.) A small "Reset to center" sets 50/50.
- Hard-enforce <=1 MB: after `prepareImageForUpload`, if `file.size > 1_048_576` show an inline error and block save (compress already targets ~1 MB; this is the explicit guard the brief asks for).

Wire `app/(app)/profile/edit/actions.ts:7-54` to read `banner_preset` (string | ""), `cover_focal_x`, `cover_focal_y` (ints, default 50) and pass to `updateProfile`. In `lib/db/profiles.ts:81-138` extend the `updateProfile` payload + `updateFields` with `banner_preset`, `cover_focal_x`, `cover_focal_y`. Selecting a preset writes `cover_url = null`; uploading writes `cover_url` and leaves `banner_preset = null`.

### Step 5 - Profile strength (owner-only, real, actionable)
New `components/composite/ProfileStrength.tsx` (client, collapsible) + a pure scorer `lib/profile/strength.ts`:
```ts
export interface StrengthItem { key: string; label: string; done: boolean; href: string; weight: number; }
export function computeStrength(p: Profile, counts: {posts:number; projects:number; connections:number}): { score: number; items: StrengthItem[] };
```
Weighted, real signals (replaces the 6-field ratio at `profile/page.tsx:46-48`): avatar, banner set, bio >= 40 chars, college, branch, year, city, >=1 link, >=3 posts, >=1 project, >=5 connections, verified. Score = round(sum(done*weight)/sum(weight)*100). Each unmet item links to `/profile/edit` (or `/collabs/new`, `/network`) so it is a real checklist, LinkedIn-style.
- Render `<ProfileStrength>` ONLY in `app/(app)/profile/page.tsx`, never in `/u/[handle]`. Guard the component itself with an `ownerOnly` invariant: it accepts no data unless rendered on the owner route, and we add a comment + a runtime `if (!isOwner) return null;` to make the owner-only rule explicit and refactor-safe (fixes 1c).
- The stats strip (`profile/page.tsx:208-230`) keeps Connections / Posts / Projects for everyone; "Profile score" cell is removed from the public-shareable strip and folded into the owner-only `<ProfileStrength>` meter.

### Step 6 - Real Highlights (collections)
- DB from Step 0. New `lib/db/highlights.ts`: `getHighlights(userId)`, `createHighlight`, `addPostToHighlight`, `removeHighlight`, `reorderHighlights`.
- Owner: in the Highlights tab (`ProfileTabs.tsx:470-541`) add a "+ New highlight" bubble (first position) and a "..." menu per highlight to rename/add posts/delete. Picking a cover = preset from `lib/profile/banners.ts` reused, or a post image (`cover_kind`).
- Keep backward-compat: if a user has zero collections, fall back to the current pinned/`is_highlight` derived bubbles so nothing regresses, but show the "create a highlight" CTA.
- Visitor: render the same highlight bubbles read-only (no create/edit controls). This makes Highlights real and curated (fixes 1d).
- Add a general "Add to highlights" affordance to `PostCard` actions (reuse the existing pin menu in `components/composite/PostCard.tsx`) so normal posts - not just reposts - can be highlighted (removes the repost-only dead end at `lib/db/posts.ts:280-283`).

### Step 7 - Symmetrical visitor tabs + richer About
- Extract the tab shell so `/u/[handle]` uses `<ProfileTabs>` too (currently it has a bespoke flat list, `app/u/[handle]/page.tsx:207-279`). Pass `isOwner={false}` so delete/pin/create controls are hidden but Posts/Projects/Highlights/About all render.
- Visitor Projects tab shows BOTH "authored projects" and "verified contributions" under one Projects tab with sub-headers (unifies the two concepts from 1d; both already have real queries: `getVerifiedProjectsForUser` + a public `projects where author_id` query).
- Enrich About (`ProfileTabs.tsx:546-611`) to also show city, year of study, account type, interests (chips), and the social links row - all already on `Profile`. No fake fields.
- Add the stats strip (Connections/Posts/Projects) to the visitor page for parity (no score).

### Step 8 - Image + paint quality
- `Avatar.tsx:38-40` and the banner `<img>`: add `loading="eager"`/`fetchPriority="high"` for the above-the-fold cover and avatar so they paint immediately; `decoding="async"`.
- Keep raw `<img>` (Supabase public URLs) but add a tiny cobalt shimmer placeholder background on the banner frame so it never flashes empty.

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

- **Banner picker is fully optimistic & local:** preset selection and drag-reposition update the live `<ProfileBanner>` instantly in the editor (no server round trip until Save). This is pure client state, so it feels instant by construction.
- **Optimistic profile save:** convert the edit submit so that on `startTransition` we (a) immediately `router.push("/profile")` and (b) seed the destination from a small client cache / `router.refresh()` rather than blocking on the redirect inside the action. Replace the hard `redirect("/profile")` in `edit/actions.ts:53` with returning `{ ok: true }` and let the client navigate, so the new name/banner show without a perceived reload. Keep `revalidatePath("/profile")` + `revalidatePath("/u/[handle]")` (already present, `edit/actions.ts:51-52`) for correctness.
- **Highlights mutations optimistic:** add/rename/reorder/delete update the bubble row immediately, then sync; on failure, roll back (mirror the proven pattern in `ProfileActions.tsx:40-74`).
- **Cache / instant nav:** keep `force-dynamic` only where auth-sensitive; tab switching is already client-side (`ProfileTabs` uses local `useState`, `ProfileTabs.tsx:355`) so it is instant - preserve that. Prefetch `/u/[handle]` from the owner's "Share/View public profile" link.
- **Fewer round trips:** the owner page already parallelizes with `Promise.all` (`profile/page.tsx:22-25`); add the highlight + strength-count queries into that same `Promise.all` rather than sequential `await`s (the project count/list at `profile/page.tsx:32-43` currently runs after the first `Promise.all` - fold it in).

---

## 5. HONESTY + CONTRAST NOTES (what to fix)

- **Fix invisible name (1b):** identity-card + scrim (Step 2/3). Guaranteed >= 4.5:1 on any banner.
- **`text-bone` as readable text (low contrast):** `profile/page.tsx:160`; `ProfileTabs.tsx:152,271,560`. Replace with `text-ash` or a real dot element. `text-bone` stays for borders only.
- **Dead public cover path (1a):** public page ignores `cover_url`; fixed by the shared `<ProfileBanner>` (Step 2). No more "owner sees a cover nobody else does."
- **Repost-only highlights (1d):** `is_highlight` was reachable only via `convertRepostToHighlight` (`lib/db/posts.ts:280-283`); Step 6 makes highlights a real, general, curated feature (or removes the half-feature in favor of collections).
- **Score honesty (1c):** keep the score real but make it richer and actionable, and enforce owner-only at the component level so it can never leak to visitors.
- No fake/mock data introduced anywhere. The `mock` flag in `ProfileActions.tsx:38` is an out-of-area concern (it only disables buttons when `targetUserId` is absent) - not touched here, but flagged: every render of `ProfileActions` in the profile pages passes a real `targetUserId`, so no mock path is exercised on this surface.
- Company facts unchanged; no em dashes, no Hindi-only strings introduced.

---

## 6. OPEN QUESTIONS FOR THE FOUNDER

1. **Banner default for existing users:** existing profiles have `banner_preset = null` and (mostly) `cover_url = null`. Default everyone to `cobalt-aurora`, or keep the current dark-gradient look as a named preset (`midnight-mesh`) so nothing visually changes on launch?
2. **Identity layout:** prefer the **LinkedIn identity-card** (name on a solid paper card below the banner) or the **X/Twitter on-banner name with scrim**? Plan assumes the card (most legible); confirm.
3. **Highlights scope for v1:** ship full curated collections (Step 6 tables), or v1 = just a real "Add to highlights" toggle on any post (reusing `is_highlight`) and defer collections? Collections is the world-class target but is more build.
4. **Projects tab on visitor page:** merge "authored projects" + "verified contributions" under one Projects tab (plan's choice), or keep "Verified contributions" as its own distinct section for trust signaling?
5. **Profile strength visibility:** owner-only meter is required - do you also want a subtle "X% complete" nudge in the top nav/onboarding, or strictly only on `/profile`?
6. **Upload size:** brief says <=1 MB. `prepareImageForUpload` already targets ~1 MB but can occasionally exceed it for some inputs - confirm a hard reject at 1 MB (plan's choice) vs. just best-effort compression.
