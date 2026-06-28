# 01 — Foundation + Cross-Cutting Overhaul Plan

Area owner: Foundation. Scope: auth-aware nav, avatar/initials bug, global contrast,
font cascade, and the shared optimistic-UI + client-cache architecture every other
area will build on.

Hard environment fact discovered up front (governs the whole plan):

- **React is pinned to `18.3.1`** (`package.json` deps; verified
  `node -e "require('react').useOptimistic" -> undefined`). Next is `16.2.9`.
  **`useOptimistic` and `useFormStatus`/`useActionState` from React 19 are NOT
  available.** Therefore the optimistic architecture below is built on a small,
  hand-rolled hook on top of `useState` + `useTransition` (which the codebase
  already uses correctly in `PostCard`/`ProfileActions`). No dependency upgrade is
  required, so this stays zero added cost. (If the founder later wants React 19, the
  hook is a drop-in wrapper that can be swapped to `useOptimistic` internally.)

---

## 1. CURRENT STATE

### 1a. Auth-aware nav — where the WRONG (marketing) nav still shows

There are three navs in the app:

- `components/layout/AppShell.tsx` — the real signed-in shell (sidebar + top bar +
  mobile bottom nav). Used by `app/(app)/layout.tsx` for every gated route. Correct.
- `components/layout/PublicTopNav.tsx` — auth-aware: calls `getMyProfile()` and
  returns the marketing `<Nav/>` only when signed out, otherwise an app nav with the
  user avatar (`PublicTopNav.tsx:24-28`). Correct pattern.
- `components/landing/Nav.tsx` — the marketing nav with **"Log in" (`Nav.tsx:79-84`)
  and "Get started" (`Nav.tsx:85-96`, `92-96`)**. This must never render for a
  logged-in user.

**BUG — project page leaks the marketing nav to logged-in users.**
`app/c/[short_id]/page.tsx` imports `Nav` directly (`c/[short_id]/page.tsx:2`) and
renders `<Nav />` in both the not-found branch (`:34`) and the main project view
(`:84`). A signed-in member who opens any `/c/<id>` project link sees "Log in /
Get started". This is the single concrete offender.

Secondary (correct but worth noting): `app/(marketing)/*` pages (`page.tsx:12`,
`about/page.tsx:68`, `manifesto/page.tsx:11`) render `<Nav/>` directly — that is
fine because `middleware.ts:47-51` redirects a logged-in user away from `/`,
`/login`, `/signup`. But `/about`, `/manifesto`, `/c/[short_id]`, and the `/u`,
`/p` *not-found / private* fallbacks are **not** in the middleware redirect list, so
a logged-in user genuinely can land on them. `/u` and `/p` already use the
auth-aware `PublicTopNav` (good — `u/[handle]/page.tsx:78,106,139`,
`p/[short_id]/page.tsx:20,49`); `/c`, `/about`, `/manifesto` do not.

### 1b. Avatar / initials bug — the composer "Y"

`components/composite/PostComposer.tsx:234`:

```tsx
<Avatar name="You" size="md" className="shrink-0" />
```

`Avatar` (`components/primitives/Avatar.tsx:19-26`) derives initials from `name`, so
`"You"` renders **"Y"** with no photo, even though the real user is e.g. "Shaurya
Punj" (sidebar shows "SP" correctly because `AppShell` is fed the real profile —
`app/(app)/layout.tsx:7-9`). The composer component takes only `{ action }`
(`PostComposer.tsx:22-25`) and is rendered in `app/(app)/home/page.tsx:201` even
though that page already loads `getMyProfile()` (`home/page.tsx:25`) and has
`profile.name` / `profile.avatar_url` in scope. The real identity is one prop away.

Related "You" string defaults (lower severity, but should be made real where a real
name exists):
- `components/composite/CommentsSection.tsx:39` — `currentUserName = "You"` default.
  It is fed the real name on the post page (`p/[short_id]/page.tsx:125`
  `currentUserName={me?.name ?? "You"}`), so optimistic comment avatars are correct
  there; the `"You"` only shows if name is missing.
- `components/layout/AppShell.tsx:61` — `displayName = me?.name ?? "You"`. Acceptable
  as a last-resort fallback because `me` is null only when truly logged out, but the
  composer bug above proves we should standardize the fallback (see 5).

### 1c. Global contrast audit (offenders with file:line)

Tokens (`app/globals.css:14-24`): ink `#0A0F1C`, ash `#5A6A86`, bone `#DDE3EE`,
cream `#F5F7FB`, saffron `#2C5BFF`, moss `#047857`. On cream, ash gives ~5.0:1
(passes for body), bone-on-cream is ~1.2:1 (decorative only — fine for dividers,
**never** for text).

Confirmed low-contrast / blend offenders:

| File:line | Issue | Contrast |
|---|---|---|
| `app/(app)/explore/page.tsx:200` | trending rank text `text-ink/40` on white | ink at 40% opacity ≈ 2.3:1 — fails AA |
| `components/layout/AppShell.tsx:237,252` | inactive bottom-nav `text-ink/60` | ≈ 3.6:1 — fails AA for the 10px label |
| `components/layout/AppShell.tsx:117` | `text-ink/80` nav links | passes but inconsistent with token system |
| `components/landing/CTABand.tsx:52,67` | `text-cream/50` placeholder + caption on dark navy | borderline; the `/50` caption is the weakest |
| `components/landing/Quote.tsx:10,28`, `Footer.tsx:34,41,69` | `text-cream/50–60` on dark | secondary text but several dip under 4.5:1 |
| `app/(marketing)/manifesto/page.tsx:271` | `text-cream/60` caption | borderline on dark |
| `components/composite/PostCard.tsx:407,411` etc. | `text-bone` middot separators | decorative dots only — OK, but `text-bone` must never be used for words |
| `app/(app)/profile/page.tsx:160,166` | branch/year wrapped in `text-bone` span then re-set to `text-ash` inside | the outer `text-bone` is the `·` separators only, so OK, but fragile |

Not a contrast bug (verified): the profile name on the dark cover band is **not** on
the band — the cover is `h-40/52/65` (`profile/page.tsx:66`) and the name sits in the
`-mt-14` header **below** the band on cream with `text-ink` (`profile/page.tsx:133`).
Same on `/u` (`u/[handle]/page.tsx:160`). So the "name invisible on banner" risk does
not currently exist; the avatar overlaps the band but the name does not. Keep this
invariant when redesigning.

### 1d. Font integration

`app/layout.tsx:35-38` loads **Sora + Inter + Noto Sans Devanagari + JetBrains Mono**
via a single Google Fonts `<link>`. Tokens map `--font-serif` → Sora,
`--font-sans` → Inter, `--font-mono` → JetBrains, `--font-indic` → Noto
(`globals.css:28-31`). `body` uses `--font-sans` (`globals.css:101`). Display
utilities `.text-display-*` and `.text-caption` force `--font-serif`/weights
(`globals.css:122-151`).

- **No leftover Fraunces / Instrument / Hanken / Playfair / Crimson references**
  anywhere (grep clean; the only "frau"/"serif" hits are the word "fraud" in
  `lib/moderation/guardrail.ts:56` and "serendipity"/comment text in
  `lib/ranker/score.ts:111`). Cascade is consistent.
- Minor: fonts load via render-blocking `<link rel="stylesheet">` rather than
  `next/font`, so there is no `font-display` control beyond the URL's
  `&display=swap` (present — good) and no self-hosting/preload of the actual woff2.
  This is a perf/poly item, not a mismatch. Flagged in §4.

### 1e. Optimistic-UI + client-cache — current reality

Good news: the **pattern already exists**, hand-rolled and duplicated:
- `PostCard.toggleLike` / `pickReaction` / `toggleSave` (`PostCard.tsx:146-212`):
  set state immediately, `startTransition(async)` to call the action, **revert on
  `!res.ok`**. Textbook optimistic.
- `ProfileActions` (`ProfileActions.tsx:40-74`): same shape for follow/connect.
- `CommentsSection` (`CommentsSection.tsx:71-79`): optimistic like + optimistic
  comment insert (`optimistic-` id prefix).

The problems:
1. **Duplication / no shared primitive.** Every surface re-implements
   prev-snapshot + revert by hand. New areas (network, news, trending) will copy or
   diverge.
2. **`revalidatePath("/home")` on every micro-interaction is the lag.**
   `engagement-actions.ts:13-69` calls `revalidatePath("/home")` after **like,
   unlike, react, comment, repost, bookmark, unbookmark**. `app/(app)/home/page.tsx`
   is `export const dynamic = "force-dynamic"` (`home/page.tsx:22`) and on every
   request awaits **four feeds + two news fetches + engagement state**
   (`home/page.tsx:31-47`). So a single like fires a full server re-render of the
   entire feed in the background (~hundreds of ms to ~1s), which is exactly the
   "feels laggy / ~1s to register" the founder reports. The optimistic state updates
   instantly, but the heavy revalidation runs anyway and, on completion, React
   reconciles fresh server props that can **stomp** local optimistic state if the
   server snapshot lags the write (read-after-write race). This is the #1 perceived-
   latency bug in the app and it is cross-cutting.
3. **No client navigation cache tuning.** Next 16 App Router defaults the client
   Router Cache `staleTimes` to 0 for dynamic segments, so back/forward and tab
   switches refetch. Combined with `force-dynamic`, navigation feels cold.

---

## 2. TARGET — world-class + real

Reference systems: **LinkedIn** (reactions update instantly, count animates, page
never reloads on a like), **Twitter/X** (like/repost are pure client toggles synced
in background; nav is instant via cached timelines), **Instagram** (double-tap like
is optimistic and never blocks), **Notion** (every keystroke/toggle is local-first).

1. **One nav truth:** a logged-in user sees app chrome everywhere; the marketing
   `Nav` (with Log in / Get started) renders only for genuinely logged-out visitors.
   Every public-but-reachable page (`/u`, `/p`, `/c`, `/about`, `/manifesto`) routes
   its top nav through a single auth-aware component.

2. **Real identity everywhere:** the composer, optimistic comments, and every
   "you" surface use the real `profile.name` + `avatar_url`. No placeholder initials.

3. **Everything pops:** no text below WCAG AA (4.5:1 body / 3:1 large). Muted text
   uses the `ash` token (which passes), never `ink/40`, `ink/60`, `bone`, or
   `cream/50` for words. A single audited set of "muted" classes.

4. **Instant interactions, instant navigation:** every like/save/react/follow/
   comment updates the screen in <16ms and **never triggers a full-page server
   revalidation**; the server write happens in the background and reconciles
   counts surgically. Navigation between app tabs is served from a warm client cache.

---

## 3. STEP-BY-STEP PLAN

### Step 1 — Kill the marketing-nav leak (auth-aware nav)

**Goal:** logged-in users never see `<Nav/>`'s Log in / Get started.

1. `app/c/[short_id]/page.tsx`
   - Remove `import { Nav } from "@/components/landing/Nav"` (`:2`).
   - Add `import { PublicTopNav } from "@/components/layout/PublicTopNav"`.
   - Replace `<Nav />` at `:34` and `:84` with `<PublicTopNav />`.
   - This page is a server component, `PublicTopNav` is an async server component
     that already self-resolves auth — drop-in compatible.
   - Adjust top padding: `Nav` and `PublicTopNav` are both `fixed h-16`, so existing
     `pt-28/pt-40` spacing is unchanged.

2. `app/(marketing)/about/page.tsx:68` and `app/(marketing)/manifesto/page.tsx:11`
   - Replace `<Nav />` with `<PublicTopNav />` so a signed-in user reading About/
     Manifesto gets app chrome and their avatar, matching `/u` and `/p`.
   - `PublicTopNav` returns the marketing `<Nav/>` for logged-out visitors
     (`PublicTopNav.tsx:28`), so the public marketing look is preserved exactly.

3. Leave `app/(marketing)/page.tsx:12` (the landing hero) using `<Nav/>` directly —
   middleware (`middleware.ts:47-51`) guarantees only logged-out users reach `/`.

4. **Guardrail so this never regresses:** add an ESLint `no-restricted-imports`
   rule (or a one-line comment convention) forbidding `components/landing/Nav`
   imports outside `app/(marketing)/page.tsx`, `components/landing/*`, and
   `PublicTopNav.tsx`. (Config lives in the project's eslint setup; flag for the
   founder if no flat-config file is present.)

### Step 2 — Real avatar/name in the composer (and standardize the fallback)

1. `components/composite/PostComposer.tsx`
   - Extend props (`:22-25`):
     ```ts
     interface PostComposerProps {
       action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
       author: { name: string; avatar_url: string | null };
     }
     ```
   - Destructure `author` (`:48`) and replace `:234`:
     ```tsx
     <Avatar name={author.name} src={author.avatar_url ?? undefined} size="md" className="shrink-0" />
     ```
2. `app/(app)/home/page.tsx`
   - At `:201` pass the already-loaded profile:
     ```tsx
     <PostComposer
       action={createPostAction}
       author={{ name: profile?.name ?? "You", avatar_url: profile?.avatar_url ?? null }}
     />
     ```
   - `profile` is already fetched at `:25`; zero extra queries.
3. Audit every other `PostComposer` mount (none today besides home) and pass `author`.
4. `components/composite/CommentsSection.tsx` — also accept `currentUserAvatarUrl?:
   string` and feed it to the optimistic comment's `Avatar` so the optimistic comment
   shows the user's photo, not just initials. Pass it from `p/[short_id]/page.tsx`
   (the page already has `me`).

### Step 3 — Global contrast fix (token-based, no new colors)

Principle: replace every opacity-based muted text with the **`ash` token** (or
`ink` for primary), and reserve `bone`/low-opacity strictly for borders, dividers,
and the `·` separators.

1. `app/(app)/explore/page.tsx:200` — change the `else` branch from `text-ink/40` to
   `text-ash` (passes AA, still visibly de-emphasized below rank 3).
2. `components/layout/AppShell.tsx`
   - `:237` and `:252` inactive states: `text-ink/60` → `text-ash` (≈5:1).
   - `:117` and `:213` (`text-ink/80`, `text-ink/85`) → `text-ink` with the active
     state untouched, for token consistency.
3. Dark-surface landing text (on navy, where `cream` is the text color):
   - `components/landing/CTABand.tsx:52` placeholder `text-cream/50` → `text-cream/70`;
     `:67` caption `text-cream/50` → `text-cream/75`.
   - `components/landing/Quote.tsx:10,28`, `Footer.tsx:34,41,69`,
     `manifesto/page.tsx:271`: bump every `text-cream/50` → `text-cream/75` and
     `text-cream/60` → `text-cream/80`. (On `#0B1220` navy, cream at 75% ≈ 4.6:1.)
4. Add a canonical muted utility to `app/globals.css` (additive, after `.text-caption`)
   so future surfaces never reach for opacity:
   ```css
   .text-muted   { color: var(--color-ash); }        /* AA on cream/paper */
   .text-muted-d { color: color-mix(in srgb, var(--color-cream) 80%, transparent); } /* on dark */
   ```
   Then sweep the worst offenders above to these classes.
5. Verify `Tag` `moss`/`saffron` variants (`Tag.tsx:12-14`): `text-saffron-dk` and
   `text-moss` on their 10% tints both pass on cream — **no change needed**, but
   confirm the moss tag is never placed on a moss/green background elsewhere (grep:
   none today). Document the rule.
6. Add an automated guard (optional, flag to founder): a small `scripts/contrast-
   lint.mjs` that greps for `text-ink/[1-6]0`, `text-cream/[1-5]0`, and `text-bone`
   used as text and fails CI. Keeps the win permanent.

### Step 4 — Shared optimistic-UI hook + client cache (the architecture)

This is the load-bearing deliverable other areas consume.

**4a. Create `lib/hooks/useOptimisticAction.ts`** (new file, client util).

A typed wrapper over `useState` + `useTransition` that encodes the
snapshot/apply/revert pattern already proven in `PostCard`. Shape:

```ts
"use client";
import { useState, useTransition, useRef, useCallback } from "react";

type ActionResult = { ok: boolean; error?: string };

export function useOptimistic<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(0);

  // optimisticUpdate: pure (current) => next. run: server action returning ActionResult.
  const mutate = useCallback(
    (optimisticUpdate: (cur: T) => T, run: () => Promise<ActionResult>) => {
      setError(null);
      const prev = value;                 // snapshot
      setValue(optimisticUpdate);         // apply instantly
      const ticket = ++inflight.current;
      startTransition(async () => {
        const res = await run();
        if (!res.ok) {
          // only revert if no newer mutation superseded this one
          if (ticket === inflight.current) setValue(prev);
          setError(res.error ?? "Something went wrong.");
        }
      });
    },
    [value]
  );

  return { value, setValue, mutate, isPending, error };
}
```

Why this and not React 19 `useOptimistic`: `useOptimistic` is unavailable on React
18.3.1 (verified). This hook gives the same DX (instant apply, auto-revert), adds
**inflight ticketing** so rapid double-clicks don't revert a newer state, and stays
zero-dependency. Internals can later be swapped to `useOptimistic` without changing
call sites.

**4b. Refactor existing surfaces onto it (proves the pattern, removes duplication):**
- `PostCard.tsx` `toggleLike`/`pickReaction`/`toggleSave` → `mutate(...)`. Keeps the
  exact UX, deletes ~40 lines of manual revert bookkeeping.
- `ProfileActions.tsx` follow/connect → `mutate(...)`.
- `CommentsSection.tsx` like toggle → `mutate(...)`.
Other area owners (network, news, trending) import this hook for follow/react/etc.

**4c. STOP the full-feed revalidation on micro-interactions (the real lag fix).**

Replace blanket `revalidatePath("/home")` in
`app/(app)/home/engagement-actions.ts:13-69` with **no path revalidation** for
like / unlike / react / bookmark / unbookmark. These are pure counters the client
already owns optimistically; the DB write is authoritative and persists, and the next
natural navigation/refresh re-reads correct counts. Concretely:
- `likePostAction`, `unlikePostAction`, `reactToPostAction`, `bookmarkPostAction`,
  `unbookmarkPostAction`: **remove** the `revalidatePath("/home")` lines (`:15,22,27,
  61,67`). The action still returns `{ ok }` so the optimistic hook can revert on
  failure.
- `addCommentAction` / `repostPostAction` change *content* (a new card/comment). Keep
  a revalidation but make it **targeted**: revalidate the specific post page
  (`/p/[short_id]`) rather than the whole `/home` feed, or rely on the client
  inserting the optimistic comment (already done in `CommentsSection`) and skip
  revalidation entirely on `/home`. Decision flagged in §6.
- Net effect: a like no longer triggers a 4-feed + news server re-render. Perceived
  latency drops from ~1s to ~0; no state-stomp race.

**4d. Surgical count reconciliation (optional, LinkedIn-grade).** For the rare case
where the server count must correct the optimistic one (e.g. someone else liked
concurrently), expose a tiny `getPostCounts(ids[])` reader and call it lazily
(on viewport re-entry / focus) rather than via full revalidation. Flag as phase 2.

**4e. Client navigation cache (instant tab switches).**
- In `next.config.ts`, set:
  ```ts
  experimental: { staleTimes: { dynamic: 30, static: 180 } }
  ```
  so switching between Home/Explore/Network/Profile within 30s serves from the
  client Router Cache instead of refetching — navigation feels instant. (Verify the
  key name against the installed Next 16.2.9 `experimental` surface; if renamed, use
  the current equivalent — flagged in §6.)
- Reconsider `export const dynamic = "force-dynamic"` on `home/page.tsx:22`. It is
  there because the feed is per-user and live. Keep `force-dynamic` for correctness,
  but the `staleTimes` client cache + removal of like-triggered revalidation means
  the page is only re-rendered on real navigation, not on every reaction.
- Prefetch: ensure the `AppShell` sidebar/bottom-nav `<Link>`s keep default
  prefetching (they do — plain `next/link`), so destinations are warm before click.

**4f. Self-host fonts (perf polish, prevents FOUT/flash).** Migrate the
`app/layout.tsx:35-38` `<link>` to `next/font/google` for Sora + Inter (and keep the
Devanagari/Mono link or move them too). `next/font` self-hosts woff2, eliminates the
render-blocking external request, and gives automatic `font-display: swap` + size-
adjust to cut layout shift. Token names stay identical (`--font-serif`/`--font-sans`)
by passing `variable: "--font-serif"` etc. Pure perf, no visual change. Flag as
optional in §6 since the current `display=swap` already prevents invisible text.

### Step 5 — Standardize the identity fallback

Create `lib/ui/identity.ts` with a single helper so "You" is only ever a true-logged-
out fallback, and is never used when a profile exists:
```ts
export function displayIdentity(p?: { name?: string | null; avatar_url?: string | null } | null) {
  return { name: p?.name?.trim() || "You", avatar_url: p?.avatar_url ?? null };
}
```
Use it in `AppShell` (`:61`), `PostComposer`, `CommentsSection`, and any future
author-row surface, so the fallback logic lives in one place.

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

- **Root cause of the ~1s lag is `revalidatePath("/home")` on every reaction**
  (`engagement-actions.ts`) against a `force-dynamic` page that refetches 4 feeds +
  news + engagement (`home/page.tsx:22,31-47`). Removing micro-interaction
  revalidation (Step 4c) is the single biggest perceived-latency win and is required
  for every other area to feel instant.
- The shared `useOptimisticAction` hook (Step 4a) gives every area apply-instantly +
  auto-revert with inflight ticketing, so rapid taps never flicker.
- `staleTimes` (Step 4e) makes Home↔Explore↔Network↔Profile switches instant from
  the client Router Cache.
- `next/font` (Step 4f) removes the render-blocking font request and layout shift.
- All transforms already respect `prefers-reduced-motion` (`globals.css:244-253`) —
  keep that invariant for any new motion.

## 5. HONESTY + CONTRAST NOTES

- **Fake/placeholder removed:** the `name="You"` avatar in the composer
  (`PostComposer.tsx:234`) is a placeholder masquerading as the user — replaced with
  the real `profile.name` + `avatar_url`. Same for the `"You"` defaults in
  `CommentsSection` and the standardized `AppShell` fallback (only shows when truly
  logged out).
- **No mock data introduced.** The optimistic hook reflects a real pending DB write
  and reverts on real failure — it is not synthetic; the count shown is the user's
  own action applied locally before the round-trip.
- **Contrast:** offenders listed in §1c get token-based fixes in Step 3
  (`text-ink/40` → `text-ash`, `text-ink/60` → `text-ash`, dark `text-cream/50-60`
  bumped to `/75-80`). `bone` and low-opacity reserved for borders/separators only.
  The profile/`u` name is verified to sit on cream (not on the dark band), so it is
  not an offender — keep that layout invariant.
- **No em dashes** introduced (this doc and all planned copy use hyphens/colons).
- **Company facts** unaffected by this area; nothing claims a city — existing copy
  says "India".

## 6. OPEN QUESTIONS for the founder

1. **Comment/repost revalidation:** after removing like-revalidation, do you want
   `addComment`/`repost` to (a) skip `/home` revalidation entirely and rely on the
   optimistic insert, or (b) keep a *targeted* `/p/[short_id]` revalidation? (a) is
   faster; (b) is safest for cross-device consistency. Recommendation: (a) for the
   feed, with a lazy focus-time count refresh (Step 4d).
2. **`staleTimes` value:** 30s dynamic feels instant but can show a feed up to 30s
   stale on back-navigation. Acceptable, or prefer a shorter window (e.g. 10s)?
3. **About/Manifesto nav:** confirm you want logged-in users to see app chrome
   (`PublicTopNav`) on `/about` and `/manifesto`, matching `/u` and `/p`. (LinkedIn
   does this — your nav stays with you on public/marketing pages once logged in.)
4. **`next/font` migration (Step 4f):** in scope now (perf win, self-hosted fonts) or
   defer? It is optional since `display=swap` already prevents invisible text.
5. **React 19 upgrade:** out of scope here (we target 18.3.1). Want it on the roadmap
   so we can swap the hook internals to native `useOptimistic` later?
6. **ESLint guardrail:** is there a flat ESLint config we can add the
   `no-restricted-imports` rule to, or should the nav rule be enforced by the
   `scripts/contrast-lint.mjs`-style check instead?
