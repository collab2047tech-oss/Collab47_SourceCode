# Collab47 - Master Overhaul Plan

Written 19 July 2026. Orchestrator: Fable. Builders: Opus subagents with tight specs.
Scope: every element, component, feature. Local only - nothing deploys without explicit approval.

## Ground rules (non-negotiable, apply to every phase)

1. **Nothing invented.** All marketing copy traces to `docs/DECK_CONTENT_EXTRACT.md` (37 deck pages, read verbatim) or to what the running app actually does. No fake stats, no fake testimonials, no mock data presented as real. Anything synthetic is labelled to the founder before it ships.
2. **Backend behaviour is preserved.** Server actions, DB contracts, RLS, auth flows do not change semantics. UI overhaul only, unless a phase explicitly says otherwise and gets approval.
3. **Every change is verified in a real browser** (Playwright against the production build), not assumed from code. The clip-audit pattern generalises: no console errors, no horizontal overflow, no clipped glyphs, no dead links, AA contrast.
4. **Commit per coherent unit.** Each phase lands as one or more clean commits; anything can be reverted alone.
5. **Design tokens are the single source.** No new hardcoded hex outside the token block + the non-browser surfaces (email/OG) which mirror it.

## Design system (locked)

- **Palette (verified WCAG):** ink `#12100E` 18.98:1 · ash `#6B6559` 5.78:1 · saffron `#B95402` 4.85:1 (actions) · brand `#D76202` (logo/large graphics ONLY, 3.73:1) · moss `#106434` 7.26:1 · navy `#03265E` 14.56:1 · ember `#B91C1C` · cream `#FBF8F4` · paper `#FFFFFF` · bone `#E7E0D6`.
- **Type:** Newsreader (serif, headlines; needs 1.15em line box, floor enforced at 1.16 via `:where(.font-serif)`) + Inter (UI/body) + JetBrains Mono (numbers/meta). Display scale: 88px max on desktop (fits 1280x800).
- **Motion:** micro 150-250ms, reveals 400-700ms `--ease-out-soft`, stagger 40-60ms, overlays spring. `prefers-reduced-motion` respected everywhere (Reveal already guards; every new motion must too).
- **Spacing:** section 128px desktop / 64px mobile; card padding 28-48px; tap targets >= 44px (`.tap` util exists).
- **Every list surface must ship 4 states:** loading (skeleton matching real geometry), empty (coaching copy + one CTA), error (retry), end-of-list.
- **Every async action must ship 3 states:** pending (disabled + label change), success (optimistic or toast), failure (inline error, never silent).

## Phase 0 - Foundation + QA harness (everything else depends on this)

| Item | Detail |
|---|---|
| 0.1 Seeded QA account | Script using the Supabase service key to create/reset a `qa@collab47.local` user with a complete profile, posts, a project, connections. Playwright can then walk EVERY authed surface. Currently the inner app cannot be visually audited at all. |
| 0.2 `scripts/audit.mjs` | Generalised from the clip audit: for each route (public + authed) capture console errors, horizontal overflow, tight-leading glyph risk, dead internal links, missing alt text, sub-44px tap targets. Run before every commit; findings block the commit. |
| 0.3 Primitive audit | 6 primitives (Button, Input, Card, Avatar, Tag) get: consistent focus-visible rings, disabled states, size variants documented in one place. Add missing primitives the app fakes ad-hoc today: Modal/Sheet, Toast, Skeleton, EmptyState, Tabs, Dropdown, Tooltip, Badge, Textarea, Select, Switch. Composites migrate to them phase by phase - no more one-off implementations. |
| 0.4 Warning debt | `middleware` -> `proxy` rename (Next deprecation in the log), remove stray `~/package-lock.json` note in STATUS.md for the founder (cannot delete a file outside the repo without approval). |

## Phase 1 - First impressions (landing, auth, onboarding)

**1.1 Landing "How it works" - real section, currently a tagline block.**
4 steps, all TRUE of the running product: (1) Create your profile - work-first, portfolio over resume. (2) Show your work - posts, projects, resume. (3) Connect - follow, connect, message across the 5 audiences. (4) Collaborate - open or join projects, team up. Numbered editorial layout, deck line `Showcase Expertise. Discover Opportunities. Build Impactful Collaborations.` (P-DECK p3, verbatim) as the section kicker.

**1.2 Landing "Who it's for" - real section, currently a problem statement.**
5 audience cards from the decks: Students, Researchers, Faculty, Institutions, Industry - each with one true sentence about what they can do in the app TODAY (from route inventory, not deck vision). No unbuilt-feature promises.

**1.3 Hero + CTA band polish.** Primary `Connect. Create. Succeed.` retained. Restore `Built for India. Built to Lead.` (verified: BIZINFO p1) as the CTA-band line. Dead-button sweep: the email capture form must route to /signup carrying the email.

**1.4 Login redesign (LinkedIn-grade).** Split layout: form left, brand panel right (typography-only, no fake imagery). Show/hide password, error states inline, Google button parity with signup, correct autocomplete attrs, autofocus. Same treatment for forgot-password/reset.

**1.5 Onboarding streamline.** Kill the `review` step (submit machinery moves to interests step - the useActionState hook, ALL hidden inputs byte-identical, inline error with "Change username" jump). Merge `studentDetails` into `field` (student) and `role` into `field` (industry). Result: 4-5 steps for every type. Constraints: server contract untouched, live username check untouched, Google prefill untouched, title picker + custom interests untouched. Then polish: per-step autofocus, Enter advances, progress bar animates, step transitions respect reduced motion.

**1.6 Copy honesty sweep** across all public pages: grep-driven audit of every claim vs the extract doc. (Already fixed this session: "Three taps / 60 seconds" was false, removed.)

## Phase 2 - Core loop: feed, post, composer

**2.1 Post detail "blasts the face" fix - the named defect.**
Route-intercepted modal: `app/(app)/@modal/(.)p/[short_id]` renders PostCard-in-overlay above the feed (backdrop blur, spring in, Escape/backdrop/X close, scroll position preserved, focus trapped, URL updates). Direct hit on `/p/[short_id]` still renders the full page (SEO + shares unchanged). This is the LinkedIn/Instagram pattern and removes the jarring full-page blast.

**2.2 PostCard hierarchy.** One consistent card: author row (avatar, name, handle, time, follow affordance), body with 4-line clamp + "see more", media with fixed aspect (no layout shift), action bar (like/comment/save/share) with counts, all optimistic. Kill any per-surface PostCard drift.

**2.3 Composer.** Character-count ring, hashtag suggestions (already fed by trending), media upload with progress + client compression, draft persistence to localStorage, error recovery (never lose typed text - same principle as the onboarding state-wipe fix).

**2.4 Feed states.** Skeletons matching real card geometry, "new posts" pill on realtime arrivals, end-of-feed marker, filter UX (only-follows / hide-projects) as visible chips not buried prefs.

**2.5 Comments.** Threaded one level, optimistic add, inline error retry, author badge on OP replies.

## Phase 3 - Identity: profiles + resume

**3.1 Public profile (`/u/[handle]`).** Hero: banner, avatar overlap, name + title (new column, already live) + one-line role, stat row (CountUp), primary action (Connect/Follow/Message) with clear state. Work-first tab order: Work, Posts, Resume, About. Empty tabs coach the owner ("Add your first project") and hide gracefully for visitors.
**3.2 Profile edit.** Avatar/banner crop UI, live preview, completeness meter (strength.ts already fixed to reach 100%), section-per-card layout, sticky save with dirty-state warning.
**3.3 Resume.** The editor exists (ProfileResumeEditor); polish entry UX: date pickers, drag-reorder, per-entry save states.

## Phase 4 - Collabs (the "bare heading + about" defect, named)

**4.1 Creation wizard replaces the single form.** Steps: Basics (title, one-liner, category) -> The work (problem, what you're building, links) -> Team (roles needed: title + skills + count; commitment hrs/wk; duration; remote/city) -> Review card preview. Quality floor enforced: brief >= 140 chars, at least 1 defined role. This kills the "heading + about section goes live" embarrassment structurally.
**4.2 Project page rebuild.** Status badge (open/in progress/shipped), team grid with roles, defined role cards with per-role Apply, updates timeline (owner posts progress), applications panel for the owner (accept/decline with note - AcceptRequestButton/ApplicationsPanel exist, get redesigned in place).
**4.3 Collabs index.** Filter by category/role/commitment; card shows roles needed + commitment, not just title; empty state coaches creating the first project.
**4.4 Backend deltas needed (flagged, need approval):** `roles` (jsonb), `commitment`, `duration`, `category` columns on projects + migration. The only schema change in this plan.

## Phase 5 - Network + messages

**5.1 Network.** PersonCard: mutual-context line (same college/city/interest - all real fields), Connect states (none/pending/connected) always visible, requests inbox with accept/decline optimistic, discovery sections (same college, same interests) from real queries.
**5.2 Messages.** Thread: day separators, sent/delivered states, unread markers, typing indicator if realtime supports it (verify; do not fake it), composer autogrow + Enter/Shift-Enter, image sharing states. Rail: unread badges, last-message preview, requests separated (exists - polish). Empty states for no-conversations.

## Phase 6 - News, notifications, events, explore, settings

**6.1 News.** Reader typography pass (Newsreader body, proper measure), InShortsFeed swipe polish, save/discuss states, source attribution always visible.
**6.2 Notifications.** Group by day, group same-type actors ("A and 3 others liked..."), mark-all-read optimistic, per-item deep links verified not dead.
**6.3 Events.** EventCard states (upcoming/live/past), attend flow states, `/events/new` form parity with the new form system.
**6.4 Explore/search.** GlobalSearch: debounced, grouped results (people/posts/projects/news), keyboard navigation, recent searches (localStorage).
**6.5 Settings.** Audit every toggle actually persists (no dead switches), section layout parity, danger zone (delete account) with proper confirm.

## Phase 7 - System-wide final pass

- **Error pages:** 404 (exists, good) + error.tsx + global-error.tsx same editorial voice.
- **A11y sweep:** audit.mjs full run; aria-labels on every icon button; focus order on modals; skip-link.
- **Mobile pass at 360px:** every route; bottom-nav ergonomics; safe-area insets.
- **Perf:** route-level bundle check (`next build` output), image `sizes` attrs, LCP < 2.5s on landing + feed, font preload check.
- **Admin surfaces** (feedback, queue): functional polish only - consistent tables, action states. Internal, lower bar, but not broken.
- **Final QA matrix:** all 34 routes x (desktop/mobile) x (authed/anon) screenshot gallery for founder review.

## Execution model

- Fable = orchestrator only: specs, dispatch, verification, commits, honesty gate. Zero implementation.
- Opus subagents = builders, one bounded spec each, hard constraints inline (what must not change), tsc + build + audit.mjs must pass before they report.
- Order: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7. Within a phase, independent items run as parallel subagents (e.g. 1.1 and 1.4 concurrently - different files).
- Founder checkpoints: end of each phase = screenshot set + one-line-per-change summary. Deploy only on explicit "ship it".

## Known open questions for the founder (answer whenever, none block Phase 0-2)

1. Phase 4.4 schema additions (roles/commitment/duration/category on projects) - approve?
2. Registered address for legal pages: decks show a Patiala contact block but never call it the registered office. Confirm or leave "India".
3. Manifesto rewrite from deck material - still wanted after nav removal, or park it?
