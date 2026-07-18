# Teardown 03 - Profiles & Collabs

READ-ONLY design-engineering audit. Slice: public + owner profiles, profile edit +
resume, collabs list/create, project detail, apply/triage/deliver flows, and the
profiles/projects/resume DB layers. No source files were modified.

Design tokens (locked): ink #12100E, cream #FBF8F4, paper #FFF, saffron #B95402,
saffron-dk #A34802, brand #D76202, moss #106434, navy #03265E, ember #B91C1C,
ash #6B6559, bone #E7E0D6. Any other hardcoded hex = violation.

---

## THE CENTREPIECE: what does it take for a project to "go live"?

**Answer to the founder's flag.** A project is public and accepting applications
the instant the form is submitted - there is no review, no draft, no quality gate.

**Full field set captured at creation** (`app/(app)/collabs/new/page.tsx` +
`createProjectAction` + `lib/db/projects.ts createProject`):
- `title` (required, 1-120 chars client / clamped 160 server)
- `brief` (required, 1-1000 client / 4000 server)
- `deliverable` (required, 1-400 client / 2000 server)
- `deadline` (required date)
- `slot_count` (required, 1-8, defaults to 3)

**Minimum to go live:** a non-empty title, brief, deliverable, and a *parseable*
deadline. That's it. The founder's memory ("just a heading and a basic about
section") is nearly right - `deliverable` and `deadline` are also required, but
there is **no substance floor**:
- No minimum length. `title="x"`, `brief="hi"`, `deliverable="y"` all pass
  (`createProject` only checks truthiness after trim; server clamp is max-only).
- The client sets `min={today}` on the date input, but the server only runs
  `Date.parse` (`projects.ts:35`) - a past date passes server validation, so the
  client guard is bypassable.
- The schema captures **no skills, no tags, no category, no compensation, no
  commitment/time estimate, no cover image, no location/remote flag**. There is
  nothing to make a project look substantial even if the author wanted to.
- Content is policy-moderated (`moderateContent`), but that blocks slurs, not
  thinness.

**What `c/[short_id]` renders vs what was captured:** the detail page renders
*every* captured field (title, author, deadline, slots, status, Brief,
Deliverable) - there is no hidden data. The problem is the schema itself is thin,
so a minimal project is a giant serif title over two one-line paragraphs on a
wide empty page: no tags, no skills, no imagery, no structure. That is the
"embarrassing" surface, and it is a data-model problem as much as a UI one.

---

## New Project Page (`app/(app)/collabs/new/page.tsx`)
- **Purpose:** the "post a brief" form that publishes a project live.
- **Defects:**
  - No quality floor - `title`/`brief`/`deliverable` accept 1-2 char junk
    (`page.tsx:47-87`); no minimum length anywhere.
  - Only 5 fields; no skills/tags/category/commitment/cover inputs - the reason
    project pages look empty (whole form, `page.tsx:46-124`).
  - Deadline `min` is client-only (`page.tsx:95`) and not enforced server-side
    (see `projects.ts:35`), so a past deadline can be posted via a crafted request.
  - No dirty-state protection: the "Back to Collabs" link (`page.tsx:30`) or any
    nav discards a fully typed brief with no warning.
  - `slot_count` max is 8 (`page.tsx:108`) but the accept path hard-caps a team at
    5 members (`projects.ts:325`) - the field over-promises (see Cross-cutting).
- **Missing states:** pending is handled ("Publishing..."), error is shown; but
  there is no per-field validation feedback (a single "All fields are required."
  banner from the action) and no success state (relies on server redirect).
- **A11y:** brief/deliverable textareas set `focus:outline-none` with only a border
  colour change (`page.tsx:70,85`) - weak keyboard focus. Labels present. OK
  otherwise.
- **Token violations:** none (uses `text-saffron`, `text-ember`, `border-ink/15`).
- **Verdict:** REBUILD
- **Planned fix:**
  - Add real minimums (e.g. title >= 6, brief >= 80, deliverable >= 20) enforced in
    `createProject`, not just the form.
  - Add structured fields: skills/tags (chips), category, commitment, optional
    cover image - and render them on the detail page.
  - Validate the deadline server-side (must be a future date).
  - Add unsaved-changes protection (beforeunload + intercepted nav).
  - Reconcile `slot_count` max with the 5-member cap.

## Create Project action + DB (`app/(app)/collabs/new/actions.ts`, `lib/db/projects.ts createProject`)
- **Purpose:** validate input and insert a live project + owner membership.
- **Defects:**
  - `actions.ts:14` treats all fields as pass/fail with one generic error; no
    field-level messages.
  - `projects.ts:35-39` accepts any parseable date including past dates.
  - No length floor; clamps are max-only (`projects.ts:30-32`).
  - Project is inserted with `status:"open"` immediately (`projects.ts:60`) - no
    draft/preview state exists in the model.
- **Missing states:** N/A (server).
- **Verdict:** REBUILD (validation + schema depth)
- **Planned fix:** add min-length + future-date validation; return field-keyed
  errors; consider a `draft` status so authors can preview before publishing.

## Collabs list (`app/(app)/collabs/page.tsx`)
- **Purpose:** discovery grid with status filters + text search.
- **Defects:**
  - Slot math shows "`{openSlots} of {slot_count} slots open`" (`page.tsx:181-185`)
    using `slot_count` up to 8, which the 5-cap makes misleading.
  - Status label helper here (`statusLabel`, "Team formed") disagrees with the
    detail page, which prints raw `status.replace("_"," ")` ("team formed") -
    inconsistent casing across surfaces.
- **Missing states:** empty state is good (search vs filter vs first-post CTA,
  `page.tsx:194-218`); **no loading skeleton and no error state** - this is an
  async Supabase fetch with no `loading.tsx`/`error.tsx` (see Cross-cutting). End
  state (pagination) absent - hard `limit: 24` with no "load more".
- **A11y:** search `<input type="search">` (`page.tsx:101`) has a placeholder but
  **no label / aria-label**. Filter pills are `py-1.5` (~30px tall) - under the
  44px tap target.
- **Token violations:** none.
- **Verdict:** POLISH
- **Planned fix:** add a labelled search input; add loading skeleton + error
  boundary; unify status labels via one shared helper; make tap targets >= 44px;
  fix slot copy once the cap is reconciled.

## Project detail (`app/c/[short_id]/page.tsx`)
- **Purpose:** public project page: brief, deliverable, apply/triage/deliver,
  team, progress feed.
- **Defects:**
  - Renders only title/brief/deliverable/deadline/slots/status - no tags, skills,
    category or imagery (nothing exists to render). This is the visible half of
    the centrepiece problem.
  - Status badge prints `status.replace("_"," ")` lowercased (`page.tsx:157`) e.g.
    "team formed" - inconsistent with the list's "Team formed".
  - `deliverable` is rendered without `whitespace-pre-wrap` (`page.tsx:191`) while
    `brief` has it (`page.tsx:185`) - newlines in a deliverable collapse.
  - Slot copy "`{openSlots} of {slot_count} slots open`" (`page.tsx:148-152`) is
    misleading for slot_count 6-8 given the 5-cap.
- **Missing states:** no `loading.tsx`/`error.tsx`; the page does four awaited
  queries (`page.tsx:75-82`) with no skeleton. `notFound()` handles the missing
  case. Team/progress sections have implicit empty (hidden when zero) which is
  fine.
- **A11y:** "Back to Collabs" and author links are real links. OK. Relies entirely
  on `Reveal` for content visibility (RUNTIME-CHECK - see Cross-cutting).
- **Token violations:** none in this file.
- **Verdict:** REBUILD (thin content model; needs the richer fields surfaced)
- **Planned fix:** surface skills/tags/category/cover once added; `whitespace-pre-wrap`
  on deliverable; single status-label helper; fix slot copy.

## ApplyForm (`components/composite/ApplyForm.tsx`)
- **Purpose:** applicant pitch + up to 3 links.
- **Defects:**
  - No dirty-state protection - navigating away loses a typed pitch.
  - Character counter turns ember at >800 (`ApplyForm.tsx:61`) but `maxLength=800`
    means it can never exceed - the warning state is dead code.
  - Links are free textarea (one-per-line) with no inline validation; invalid URLs
    are silently dropped server-side (`projects.ts:211-222`) with no user feedback.
- **Missing states:** pending ("Sending...") and success ("Application sent") are
  both handled well; error shown. Good.
- **A11y:** labels present; textarea `focus:outline-none` + border-only focus.
- **Token violations:** none (moss success card, ember error).
- **Verdict:** POLISH
- **Planned fix:** add unsaved-changes guard; drop or fix the dead >800 branch;
  validate links inline and report dropped ones.

## ApplicationsPanel - owner triage (`components/composite/ApplicationsPanel.tsx`)
- **Purpose:** owner reviews applicants; accept / reject / message.
- **Defects:**
  - **One-way triage.** Accept/Reject buttons render only while
    `!isResolved` (`ApplicationsPanel.tsx:176`). Once an applicant is accepted OR
    rejected, both buttons vanish, so:
    - an accidental reject cannot be undone from the UI (the server
      `acceptApplicant` would still accept a rejected user, but nothing triggers it);
    - an accepted member cannot be removed to free a slot, even though
      `rejectApplicant` supports it (`projects.ts:455-462`).
  - No confirmation on Reject (a destructive, effectively-final action in this UI).
  - Optimistic status flips immediately (`:52-59`); on failure it rolls back and
    shows one shared `actionError` at the top, not per-row.
- **Missing states:** empty ("No applications yet.") handled; pending disables all
  buttons globally (`disabled={pending}`) rather than per-row - one accept locks
  every row. No loading state on initial render (data comes from the server page).
- **A11y:** Accept/Reject/Message are text buttons - fine. But they are `size="sm"`
  = h-10 (40px), just under the 44px target.
- **Token violations:** none (Tag variants + ember).
- **Verdict:** POLISH (structurally sound; triage behaviour needs fixing)
- **Planned fix:** keep an "Undo/Move to..." control on resolved rows; allow
  removing an accepted member; confirm on reject; per-row pending + per-row error;
  bump button height to >= 44px.

## DeliverForm (`components/composite/DeliverForm.tsx`)
- **Purpose:** owner marks project delivered with a deliverable URL (verifies team).
- **Defects:**
  - Error `<p>` is the last child of a `sm:flex-row sm:items-end` row
    (`DeliverForm.tsx:30,44`), so an error renders to the *right of the button*
    instead of below the field - awkward and easy to miss.
  - No success feedback; the form silently disappears when the server revalidates.
- **Missing states:** pending ("Marking...") handled; failure shown (misplaced).
- **A11y:** labelled Input; URL type. OK.
- **Token violations:** none.
- **Verdict:** POLISH
- **Planned fix:** move error below the field; add an explicit success toast/state;
  confirm before an irreversible "delivered" transition.

## ProgressComposer (`components/composite/ProgressComposer.tsx`)
- **Purpose:** members post a progress update.
- Clean: pending / transient success ("Posted!") / error / counter all handled;
  disabled when empty. `focus:outline-none` border-only focus is the only nit.
- **Verdict:** KEEP

## Public profile (`app/u/[handle]/page.tsx`)
- **Purpose:** visitor-facing profile with privacy gate (public vs private shell).
- **Defects:**
  - Verified badge uses `background: rgba(44,91,255,0.10)` (a **non-token blue,
    #2C5BFF**) behind `color:#B95402` text + a saffron check (`page.tsx:225-227`) -
    a blue tint behind orange content; visually inconsistent and off-palette.
  - Imports the whole social-icon system (`page.tsx:7,23-69`) but `socialLinks` is
    forced to `[]` (`page.tsx:128`, intentional per brief) - the buildSocialLinks
    machinery and icon map are dead weight, though correctly non-rendering.
- **Missing states:** no `loading.tsx`/`error.tsx`; `notFound()` covers missing.
  Private shell is a genuinely good empty/gated state. Content sections hide when
  empty.
- **A11y:** social anchors (dead) carry aria-labels; headings are real `<h1>/<h2>`.
  Relies on `Reveal` for visibility (RUNTIME-CHECK).
- **Token violations:** `rgba(44,91,255,0.10)` (page.tsx:226); `color:"#B95402"`
  hardcoded instead of `text-saffron` (page.tsx:226).
- **Verdict:** POLISH
- **Planned fix:** replace the blue verified-badge tint with a saffron/token tint;
  use `text-saffron` not the literal; consider deleting the dead social plumbing.

## Owner profile (`app/(app)/profile/page.tsx`)
- **Purpose:** owner's own profile with strength meter, stats, resume editor, tabs.
- **Defects:** verified badge same `rgba(44,91,255,0.10)` blue + literal `#B95402`
  (`page.tsx:143-144`). Otherwise mirrors the public page cleanly.
- **Missing states:** `dynamic="force-dynamic"`; `redirect("/onboarding")` when no
  profile. No loading/error boundary (SSR). Empty states delegated to ProfileTabs /
  ProfileResume (good).
- **A11y:** Edit/Share are labelled. OK.
- **Token violations:** `rgba(44,91,255,0.10)` + literal `#B95402` (page.tsx:143-144).
- **Verdict:** POLISH
- **Planned fix:** shared VerifiedBadge component using tokens; drop literals.

## Profile edit page (`app/(app)/profile/edit/page.tsx`)
- Thin server wrapper; redirects to onboarding when no profile; passes props. Clean.
- **Verdict:** KEEP

## Update-profile action (`app/(app)/profile/edit/actions.ts`)
- **Purpose:** map form -> `updateProfile`, handle avatar/banner/focal persistence.
- Correct and careful (avatar-removed, preset-vs-cover mutual exclusion). Social
  plumbing commented out in lockstep with the hidden form (correct per brief).
- **Verdict:** KEEP

## strength.ts (`app/(app)/profile/strength.ts`)
- Weighted, real-data completeness metric; the hidden "link" item is correctly
  disabled so the score can reach 100%. Clean.
- **Verdict:** KEEP

## ProfileStrength (`app/(app)/profile/ProfileStrength.tsx`)
- **Purpose:** owner-only strength meter + checklist (hard `!isOwner` guard).
- **Defects:** none functional; good hard guard, aria-expanded, deep-link checklist.
- **A11y:** the toggle is a real button with `aria-expanded`. OK.
- **Token violations:**
  - `rgba(44,91,255,0.10)` non-token blue bubble (`:43`).
  - `accent` palette uses **`#1B7A4B`** (not moss #106434) and **`#F5A623`** (not
    a token at all) alongside `#B95402` (`:31`).
  - `color:"#B95402"` literal for the "Fix" affordance (`:94`).
- **Verdict:** POLISH
- **Planned fix:** map accents to moss / saffron / ember tokens; token bubble tint;
  `text-saffron` instead of the literal.

## resume-actions.ts (`app/(app)/profile/resume-actions.ts`)
- Thin pass-through to resume DB helpers. Clean.
- **Verdict:** KEEP

## ProfileEditForm (`components/composite/ProfileEditForm.tsx`)
- **Purpose:** banner (preset/upload+reposition), avatar, basic + academic info.
- **Defects:**
  - **No dirty-state protection.** The "Cancel" link (`:570`) and any nav discard
    edits + staged uploads with no warning.
  - **No upload progress.** Avatar/cover upload happens inside the form's
    `startTransition` (`:166-194`); the only feedback is the button's "Saving...".
    A large cover on a slow link just hangs (RUNTIME-CHECK).
  - **No crop.** Avatar is object-cover only; cover gets focal-point reposition
    (good) but no true crop.
  - `URL.createObjectURL` for avatar (`:101`) and cover (`:110`) previews is never
    `revokeObjectURL`'d - a small memory leak on repeated picks.
  - Links card is fully behind `{false && ...}` (`:517`) - intentional per brief,
    but ~45 lines of dead JSX remain in the tree.
- **Missing states:** pending + error handled; no explicit success (server
  redirects). No per-field validation surface.
- **A11y:** the reposition stage has `role="slider"` + aria-label + aria-valuetext
  (`:328-330`) but **no keyboard handler** - a slider you can only drag with a
  pointer. All text inputs use `focus:outline-none` + border-only focus.
- **Token violations:** `boxShadow: "0 0 0 2px #B95402"` / `"0 0 0 1px #E7E0D6"`
  literals (`:300`) and `color:"#B95402"` check (`:305`) - the hex values are the
  saffron/bone tokens but hardcoded rather than referenced.
- **Verdict:** POLISH
- **Planned fix:** add unsaved-changes guard; show real upload progress; revoke
  object URLs; add keyboard support (or arrow-key nudge) to the reposition slider;
  add a `focus-visible` ring; use token classes for the selected-preset ring.

## ProfileTabs (`components/composite/ProfileTabs.tsx`)
- **Purpose:** Posts / Projects / Highlights / About tabs for owner + visitor.
- **Defects:**
  - Project card footer always says "`{slot_count} slots open`" (`:322`)
    regardless of accepted members or status - a delivered/full project still
    reads "3 slots open".
  - Active-tab underline sets **both** `bg-saffron` class **and** inline
    `style={{ background:"#B95402" }}` (`:479-481`) - redundant literal.
- **Missing states:** every tab has a proper empty state with owner-vs-visitor copy
  and owner CTAs - genuinely good.
- **A11y:** tabs are buttons but not wired as an ARIA tablist (no `role="tab"` /
  `aria-selected` / `tabpanel`); keyboard arrow navigation absent. Delete button on
  post cards has aria-label (good, and is always visible - not hover-gated).
- **Token violations:**
  - `rgba(44,91,255,0.07)` non-token blue in EmptyState icon (`:385`).
  - `#F5A623` in the highlight-ring gradient (`:80`).
  - Literal `#B95402` in several inline styles/CTA backgrounds
    (`:263, :387, :480, :527, :667, :716`).
  - `#1a2744` (non-token dark navy) in decorative highlight gradients (`:97, :609`)
    - decorative but off-palette.
- **Verdict:** POLISH
- **Planned fix:** compute real open-slot copy on the project card; token-ise the
  empty-state tint and CTA backgrounds; drop the redundant underline literal; add
  proper tab ARIA + keyboard nav.

## ProfileActions (`components/composite/ProfileActions.tsx`)
- **Purpose:** Message / Follow / Connect buttons with optimistic state.
- **Defects:** on failure the optimistic state rolls back silently - no error
  surfaced to the user (`:47-73`). A `mock` (no targetUserId) path disables buttons
  - fine. Otherwise clean, labelled buttons with icon+text.
- **Verdict:** KEEP (add a small failure toast when polishing).

## ProfileBanner (`components/composite/ProfileBanner.tsx`)
- Single source of truth for owner + visitor banners; good scrim + focal handling +
  guaranteed navy fallback.
- **Token violations:** `bg-[#03265E]` (navy token as a literal, `:47`); scrim uses
  `rgba(10,15,28,...)` near-black (decorative). Low severity.
- **Verdict:** KEEP (swap `bg-[#03265E]` for `bg-navy`).

## ProfileResume - read view (`components/composite/ProfileResume.tsx`)
- Clean presentational timeline; hides empty sections; visitor gets read-only,
  owner delegates to the editor. Uses moss/saffron/bone tokens correctly.
- **Verdict:** KEEP

## ProfileResumeEditor (`components/composite/ProfileResumeEditor.tsx`)
- **Purpose:** optimistic CRUD for experience/education/skills in modals.
- **Defects:**
  - **Touch-unreachable controls.** `OwnerRow` edit/delete are `opacity-0`
    revealed only on `group-hover` / `focus-within` (`:446`), and the wrapped item
    has no focusable child - so on touch devices there is no way to reveal edit or
    delete for experience/education entries. Profile resume editing is effectively
    broken on mobile.
  - Those buttons are `size-7` (28px) - well under the 44px tap target even on
    desktop.
  - `removeSkill` runs a `startTransition` *inside* a `setSkills` updater
    (`:716-726`) - works, but a side effect inside a state updater is fragile under
    React strict/concurrent re-invocation.
- **Missing states:** pending/error per form handled; optimistic insert/rollback +
  temp-id reconciliation done well; empty prompts present. Good modal (Esc, scroll
  lock, aria-modal).
- **A11y:** modal is solid; icon buttons carry aria-labels; but the hover-reveal
  pattern is the a11y blocker above.
- **Token violations:** none (uses saffron/moss/ember/bone tokens).
- **Verdict:** POLISH (high-priority: touch reachability)
- **Planned fix:** make edit/delete always visible (or reveal on tap) and >= 44px;
  lift the transition out of the state updater.

## Avatar (`components/primitives/Avatar.tsx`)
- Excellent: initials painted as a base layer so a broken/empty/403 src never yields
  a blank circle; error-hides the img; `aria-label`. Best component in the slice.
- **Verdict:** KEEP

## lib/db/projects.ts
- **Purpose:** all project reads/writes.
- **Defects:**
  - **5-member hard cap vs slot_count up to 8** (`:325` cap, `:355` effectiveCap =
    `min(slot_count+1,5)`) contradicts the form and the "X of N slots open" copy
    everywhere. A slot_count of 8 can never be filled and silently flips to
    `team_formed` at 5.
  - `createProject` accepts past deadlines (`:35`) and enforces no length floor.
- Reads are well structured (member_count normalisation, escaped search `or`).
  Accept/reject/deliver logic and notifications are careful.
- **Verdict:** POLISH
- **Planned fix:** pick one cap and enforce it end to end; validate future deadline;
  add length floors.

## lib/db/resume.ts
- Clean: clamps, date-cleaning, per-write moderation, owner-scoped writes, duplicate
  handling. No issues.
- **Verdict:** KEEP

## lib/db/profiles.ts
- Robust: 7-day name/handle change window, unique-violation translation, privacy
  gate (`canViewProfileContent`), admin-client post counts that respect privacy.
  No issues in slice.
- **Verdict:** KEEP

## Primitives
- **Input (`components/primitives/Input.tsx`)** - `focus:outline-none` with only a
  border colour change and **no `focus-visible` ring** (`:22`); this weak focus
  propagates to every form in the slice. **POLISH.**
- **Button (`components/primitives/Button.tsx`)** - clean cva; `sm=h-10` (40px) is
  under 44px; no `focus-visible` ring but keeps the browser default outline. KEEP
  (bump sm, add ring when polishing).
- **Tag (`components/primitives/Tag.tsx`)** - token-correct. KEEP.

---

## Cross-cutting

- **No loading or error boundaries.** None of `collabs`, `c/[short_id]`, `profile`,
  `u/[handle]` has a `loading.tsx` or `error.tsx`. Every one is an async
  Supabase-backed server component; a slow query shows nothing, a thrown query
  crashes to the framework error page. Add route-level skeletons + error states.
- **`Reveal`/`Stagger` gate all visible content** (RUNTIME-CHECK). Profile and
  project pages wrap essentially everything - including empty states - in `Reveal`.
  If its initial style is `opacity:0` and the animation fails to fire (JS error,
  reduced-motion mishandling), the page renders blank. Verify `Reveal` respects
  `prefers-reduced-motion` and has a no-JS/failure fallback.
- **Non-token hex, recurring.** A stale blue `rgba(44,91,255,0.10 / 0.07)` (#2C5BFF)
  appears as a tint in 4 places (owner profile, public profile, ProfileStrength,
  ProfileTabs). `#F5A623` and `#1B7A4B` in ProfileStrength; `#1a2744` in ProfileTabs
  gradients. And `#B95402`/`#A34802`/`#E7E0D6`/`#03265E` are frequently hardcoded as
  literals instead of `text-saffron`/`bg-navy`/etc. Introduce a shared
  `VerifiedBadge` and token classes; purge non-palette hex.
- **No dirty-state protection on any form** (new project, apply, profile edit).
  Navigating away silently discards input. Add a shared unsaved-changes guard.
- **Weak keyboard focus everywhere.** Inputs/textareas use `focus:outline-none`
  with only a border change and no `focus-visible` ring. Fix at the Input primitive
  and the ad-hoc textareas.
- **Tap targets under 44px:** collabs filter pills (~30px), `size="sm"` buttons
  (40px) in ApplicationsPanel, resume edit/delete icon buttons (28px, and hover-
  gated).
- **Status-label inconsistency** between the collabs list ("Team formed") and the
  detail page ("team formed") - one shared helper.
- **Slot model is internally contradictory** (max 8 requested, 5 hard cap) - the
  single most user-visible logic bug in the collabs flow after the thin schema.
- **Social links:** correctly hidden everywhere (forced `[]`, form behind `false`,
  action commented in lockstep). No surface tries to render them inconsistently -
  compliant with the brief. Only note: dead icon/link plumbing remains in
  `u/[handle]/page.tsx` and ProfileEditForm.

---

## Answers to the specific questions

1. **Minimum to go live:** non-empty title + brief + deliverable + a parseable
   deadline (slot_count defaults to 3). No length floor, no future-date check
   server-side, no skills/tags/category/imagery in the schema. `c/[short_id]`
   renders all captured fields - the emptiness is the thin data model, not hidden
   data.
2. **Apply flow:** after applying, the form is replaced by a moss "Application sent"
   card; on reload the page shows a status tag - "Application sent" (pending),
   "Accepted", or "Not selected" - with a one-line explainer. Status is visible.
   Applying twice is blocked (the form is hidden once `appState.applied`, and the DB
   insert rejects duplicates via `projects.ts:250-255`).
3. **Owner triage:** ApplicationsPanel lists applicants with pitch + links and
   Accept / Reject / Message. Status flips optimistically with rollback + a shared
   error line. **But triage is one-way in the UI** - once resolved, Accept/Reject
   disappear, so accidental rejects can't be undone and accepted members can't be
   removed, despite server support. Accept enforces the 5-member cap.
4. **Profile empty states:** a brand-new profile is non-broken for both. Visitor
   sees banner + avatar-initials + name/@handle, a 0/0/0 stat strip, and per-tab
   empty copy ("This profile has no details yet."). Owner sees the same plus the
   strength meter, Edit/Share, an editable resume with "Add your experience..."
   prompts, and empty-state CTAs ("Post a brief", "Complete profile").
5. **Avatar/banner upload:** avatar = pick -> object-cover preview, client compress,
   upload on submit; **no crop, no progress bar, failure -> inline error + retry.**
   Banner = preset OR upload with **drag-to-reposition focal point** (pointer-only,
   no keyboard) and a 1 MB cap with a clear message; still **no upload progress**.
   Removal works; object URLs aren't revoked.
