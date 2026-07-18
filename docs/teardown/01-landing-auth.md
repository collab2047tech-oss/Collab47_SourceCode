# Teardown 01 - Landing + Auth slice

Design-engineering audit (READ-ONLY). Auditor slice: landing components, marketing pages, auth pages, public nav, app-level chrome.
Reference sources read in full first: `docs/DECK_CONTENT_EXTRACT.md`, `app/globals.css` (tokens).
Standard: tokens ink/cream/paper/saffron/brand/moss/navy/ember/ash/bone; serif = Newsreader (line-height floor 1.16); body = Inter; every async action needs pending(disabled+label)/success/failure; inputs need label+autocomplete+error+focus-visible; tap >= 44px; icon-only buttons need aria-label; copy must trace to the deck or real app behaviour; motion must respect prefers-reduced-motion.

Note on rem sizing: root font-size is 112.5% (18px), so Tailwind `h-10`=45px, `h-11`=49.5px, `h-12`=54px, `.tap`=49.5px. Tap-target math below uses the 18px base.

---

## Nav (`components/landing/Nav.tsx`)
- **Purpose:** Fixed marketing top nav (brand, center links, Log in / Get started, mobile sheet).
- **Defects:**
  - `Nav.tsx:40` hardcoded shadow colour `shadow-[0_1px_0_rgba(10,15,28,0.04)]` - `rgba(10,15,28,...)` is an off-token near-black, not `--color-ink` (#12100E) or any palette value.
  - `Nav.tsx:56,67` arbitrary type size `text-[0.95rem]` bypasses the type scale (no `--text-*` token at 0.95rem).
  - `Nav.tsx:96-127` mobile sheet is conditionally mounted but focus is not moved into it on open, and there is no Escape-to-close handler; keyboard/SR users get no focus trap or dismiss key. RUNTIME-CHECK.
- **Missing states:** none required (no async actions here).
- **A11y:** hamburger has `aria-label` + `aria-expanded` (good) but no `aria-controls` referencing the sheet (`Nav.tsx:83-91`). No focus management on the sheet (above).
- **Token violations:** hardcoded rgba shadow (line 40); arbitrary `text-[0.95rem]` (lines 56, 67).
- **Copy flags:** nav labels "How it works" / "Who it's for" / "About" all map to real anchors/pages - clean.
- **Verdict:** POLISH
- **Planned fix:**
  - Replace the arbitrary shadow with a token-derived value (e.g. `color-mix(in srgb, var(--color-ink) 4%, transparent)`) or a shared `.shadow-hairline` util.
  - Swap `text-[0.95rem]` for `text-body-sm`/`text-sm`.
  - Add `aria-controls` + `id` on the sheet; move focus to first link on open and close on Escape.

## Hero (`components/landing/Hero.tsx`)
- **Purpose:** Above-the-fold headline, sub, primary/secondary CTA, Viksit Bharat line.
- **Defects:**
  - `Hero.tsx:22-29` uses `SplitWords`, which animates unconditionally and ignores `prefers-reduced-motion` (see SplitWords entry) - the whole H1 slides up even for reduced-motion users.
  - `Hero.tsx:45-53` primary CTA is wrapped in `MagneticButton`, which also ignores reduced-motion (pointer-driven translate).
  - `Hero.tsx:21` arbitrary `text-[2.6rem]` for the mobile headline size (off type scale; switches to `text-display-lg`/`xl` at sm/md).
- **Missing states:** N/A (links only, no async).
- **A11y:** `SplitWords` sets `aria-label={text}` and `aria-hidden` on the animated spans (good, SR reads the whole line once). Both CTAs are real links with text.
- **Token violations:** arbitrary `text-[2.6rem]` (line 21). `leading-[1.16]` is at the serif floor - OK.
- **Copy flags:** "Connect. Create. Succeed." (traceable, deck tagline x6). "Where talent, innovation and opportunity converge." (traceable, USP circle). "Collaborate & Innovate for Viksit Bharat 2047." (traceable, title slide all 4 decks). Sub-copy "Show your work, follow what matters... team up on real projects" describes feed/follow/collab features - plausible vs app but not deck-sourced; RUNTIME-CHECK the surfaces exist.
- **Verdict:** POLISH
- **Planned fix:**
  - Make `SplitWords` and `MagneticButton` honor `useReducedMotion()` (render static).
  - Replace `text-[2.6rem]` with a scale token or a `clamp()` utility.

## Problem (`components/landing/Problem.tsx`)
- **Purpose:** Four-card "The Problem" section (id `who`).
- **Defects:**
  - `Problem.tsx:9` copy states "95% of India's talent sits outside the top fifty institutions" - a specific, unsourced statistic. The deck/manifesto frame this as "roughly five percent inside the IIT, IIM, and NIT envelope"; "top fifty institutions" and the flat 95% are not in `DECK_CONTENT_EXTRACT.md`. Needs a source or a founder-approved figure.
  - `Problem.tsx:34` arbitrary `text-[2.1rem]` (off scale).
- **Missing states:** N/A (static).
- **A11y:** clean; semantic h2/h3, decorative numbers are plain text.
- **Token violations:** `text-[2.1rem]` (line 34). All `leading-[1.16]`/`[1.2]` respect the serif floor.
- **Copy flags:** "95% ... top fifty institutions" (untraceable stat, quoted above). The four card themes (talent invisible / research without direction / hiring slow & blind / institutions can't reach industry) map cleanly to the deck CORE-GAP list - traceable.
- **Verdict:** POLISH
- **Planned fix:**
  - Re-word the 95% line to the deck-backed framing (~5% inside IIT/IIM/NIT) or cite a source; do not assert "top fifty" without one.
  - Replace `text-[2.1rem]` with a scale token.

## Product (`components/landing/Product.tsx`)
- **Purpose:** Six product-feature cards + closing signup tile ("The Product").
- **Defects:**
  - `Product.tsx:52-53` copy: "here's what you can do on Collab47 today." This is a present-tense availability claim over all six features (Profile, Feed, Collabs, Network, Messages, News). The deck explicitly marks NO feature as existing/live. Each must be verified against the running app; any non-functional surface makes this false. RUNTIME-CHECK, high priority.
  - `Product.tsx:16` "smart feed ranks the work and people that matter to you" - asserts a ranking/personalisation engine; verify it actually ranks vs. chronological. RUNTIME-CHECK.
  - `Product.tsx:46` arbitrary `text-[2.1rem]`.
- **Missing states:** N/A (static + one link).
- **A11y:** clean; `<article>` cards, semantic headings, closing tile is a real `<Link>`.
- **Token violations:** `text-[2.1rem]` (line 46).
- **Copy flags:** "One platform. Infinite collaborations." (traceable). "Connect talent. Solve real problems. Build India." (traceable, BIZINFO p5). "what you can do ... today" + "smart feed ranks" (availability/capability claims, RUNTIME-CHECK).
- **Verdict:** POLISH
- **Planned fix:**
  - Confirm all six surfaces are live in the app; if any is not, soften "today" or remove that card.
  - Confirm feed ranking exists or change "ranks" to a truthful verb.
  - Replace `text-[2.1rem]` with a scale token.

## Quote (`components/landing/Quote.tsx`)
- **Purpose:** Full-bleed ink pull-quote ("The Shift").
- **Defects:** none material. `Quote.tsx:13` uses arbitrary `text-[2rem]` for mobile size (off scale, minor).
- **Missing states:** N/A.
- **A11y:** decorative quote glyph is `aria-hidden` (good); divider rule `aria-hidden` (good).
- **Token violations:** `text-[2rem]` (line 13). All leading values (1.25/1.22/1.18/1.16) >= serif floor.
- **Copy flags:** both lines traceable ("...converge." USP circle; "Collaborate and innovate for Viksit Bharat 2047" title slide). Clean.
- **Verdict:** KEEP
- **Planned fix:** (optional) move `text-[2rem]` to a token for consistency.

## CTABand (`components/landing/CTABand.tsx`)
- **Purpose:** Email-capture band that forwards the address into `/signup`.
- **Defects:**
  - `CTABand.tsx:45-53` email `Input` has `aria-label` but no `autoComplete="email"`.
  - `CTABand.tsx:15-20` `handleSubmit` sets `done=true` then hard-navigates; there is no error branch (navigation can't really fail), acceptable, but the button's only "pending" cue is the label flip to "Taking you in." - fine.
  - `CTABand.tsx:29` arbitrary `text-[2.5rem]`.
- **Missing states:** pending/success handled via `done`; no failure state needed (client redirect). OK.
- **A11y:** status paragraph has `aria-live="polite"` (line 68) - good; email input labelled via `aria-label`.
- **Token violations:** `text-[2.5rem]` (line 29). Opacity-modified cream tokens on the input (`border-cream/20`, `bg-cream/5`) are on-system.
- **Copy flags:** "Start the profile you actually wanted on LinkedIn." (editorial opinion, acceptable). "One platform. Infinite collaborations." (traceable). "Free to join." (accurate - signup is free). Clean.
- **Verdict:** POLISH
- **Planned fix:**
  - Add `autoComplete="email"` to the input.
  - Move `text-[2.5rem]` to a scale token.

## Footer (`components/landing/Footer.tsx`)
- **Purpose:** Site footer (Product/Company/Legal columns, copyright).
- **Defects:**
  - `Footer.tsx:17` contact email `collab2047.tech@gmail.com` does not match the deck's stated contact `collab2047@gmail.com` (DECK_CONTENT_EXTRACT lines 463-464). Same address recurs in privacy/terms (see below). Not necessarily wrong (may be a newer address) but it is untraceable to any source doc and must be founder-confirmed; it also has no source of truth constant (duplicated string in 3 files).
  - `Footer.tsx:36` `<p className="font-serif text-3xl"><Wordmark/></p>` wraps `<Wordmark>` (already a `<span>` with its own serif sizing) in a `<p>` with conflicting `text-3xl` - redundant/dead styling since Wordmark sets its own size.
- **Missing states:** N/A.
- **A11y:** mailto uses raw `<a>` (correct for external); links have hover states. `text-caption` heading colour `text-cream/50` on ink - RUNTIME-CHECK contrast (caption is uppercase 0.8rem; cream/50 on ink may fall under AA for the copyright/caption text).
- **Token violations:** none hardcoded (opacity-modified cream tokens only).
- **Copy flags:** "India's unified academia-industry collaboration ecosystem." (matches metadata/positioning). "© 2026 Collab47 Technologies Private Limited. India." (entity correct). Contact-email mismatch (above).
- **Verdict:** POLISH
- **Planned fix:**
  - Confirm the canonical contact email; centralise it in one constant imported by Footer/privacy/terms.
  - Drop the redundant `text-3xl` wrapper around `<Wordmark>`.
  - RUNTIME-CHECK cream/50 caption contrast; bump to cream/60-70 if it fails AA.

## Landing page (`app/(marketing)/page.tsx`)
- **Purpose:** Composes the landing sections + Organization/WebSite JSON-LD.
- **Defects:** none. JSON-LD `description`/`legalName` match the standard entity and positioning.
- **Missing states:** N/A.
- **A11y:** single `<main>`, ordered sections.
- **Token violations:** none.
- **Copy flags:** JSON-LD description is the standard positioning line - traceable. Clean.
- **Verdict:** KEEP
- **Planned fix:** none.

## About page (`app/(marketing)/about/page.tsx` + `about/layout.tsx`)
- **Purpose:** Who-we-are hero, manifesto excerpt, four founding principles.
- **Defects:**
  - `about/page.tsx:45-56` uses `SplitWords` for the H1 - ignores `prefers-reduced-motion` (see SplitWords).
  - `about/page.tsx:16` "Vernacular, internet-poor, tier-2 and tier-3 first." asserts vernacular support. Per project memory the Hindi caption was removed in favour of an English brand line and the app appears English-first; "Vernacular ... first" reads as a current-product claim under a "rules we will not break" heading. RUNTIME-CHECK / soften if the product ships English-only today.
  - `about/page.tsx:44,89,134` arbitrary type sizes `text-[2.5rem]`, `text-[2rem]`, `text-[2.5rem]`, `text-[2.25rem]`.
- **Missing states:** N/A (static).
- **A11y:** semantic headings; values grid is plain content. Clean.
- **Token violations:** arbitrary text sizes (lines 44, 89, 134). Leading values all >= 1.16.
- **Copy flags:** "The missing link between academia and industry." (traceable, PITCHDECK p2). "bootstrap-funded" (matches company facts). "Founded 2026." (plausible/consistent). Manifesto-excerpt blockquote is quoted from the manifesto essay (internal). "Vernacular ... first" (product claim, RUNTIME-CHECK).
- **Verdict:** POLISH
- **Planned fix:**
  - Fix `SplitWords` reduced-motion (shared).
  - Reconcile the "Vernacular" principle with actual language support (keep as aspiration, or ship Indic UI).
  - Move arbitrary sizes to scale tokens.

## Manifesto page (`app/(marketing)/manifesto/page.tsx` + `manifesto/layout.tsx`)
- **Purpose:** Long-form founder essay + closing CTA.
- **Defects:**
  - `manifesto/page.tsx:201-202` garbled sentence: "When we do raise ... Until then, **the we pay for the servers.**" - dropped/duplicated word ("the we pay"). Copy defect, ships broken.
  - `manifesto/page.tsx:133-137` present-tense invented capabilities: "Underneath sits a **career impact engine that scores opportunity by what it does for you over time**, and an **anti bias layer that refuses to let pedigree be the only signal**." Neither appears in the deck and both are almost certainly unbuilt - stated as existing. High-priority honesty flag; RUNTIME-CHECK, expect false.
  - Statistic inconsistency: `page.tsx:105` "**Eighty million** Indian students are graduating" vs `page.tsx:147` "**Forty million** students will pass through Indian higher education in the next four years" vs deck TAM "43M+ Students". Three different figures; none of 80M/40M is deck-sourced. Also the title `page.tsx:26-27` "the next 40 million Indians".
  - `page.tsx:194-203` "Real opportunities, **vetted**, from real companies and real labs." - claims a vetting process + real-company opportunity supply; RUNTIME-CHECK.
  - `page.tsx:225,278` `text-[2.25rem]`, plus `text-[2.5rem]`/`text-[1.85rem]` arbitrary sizes throughout.
- **Missing states:** N/A (static + one CTA link).
- **A11y:** dropcap is a styled span within the paragraph (readable). CTA arrow glyph `aria-hidden` (good). Hidden byline/sign-off use `{false && ...}` (dead but harmless). Clean structurally.
- **Token violations:** arbitrary sizes (lines 25, 112, 181, 225, 278). Body `leading-[1.7]` is Inter body (fine). Serif leadings >= 1.16.
- **Copy flags:** garbled "the we pay for the servers" (line 202); invented "career impact engine"/"anti bias layer" (lines 133-136); unsourced/contradictory 80M vs 40M vs 43M (lines 26, 105, 147); "vetted ... real companies and real labs" (line 196-198). "bootstrapped" (accurate).
- **Verdict:** POLISH (heavy copy revision, not structural rebuild)
- **Planned fix:**
  - Fix the broken sentence on line 202.
  - Remove or reframe "career impact engine" and "anti bias layer" to what is actually built (or mark as roadmap explicitly).
  - Pick ONE student-population figure aligned to the deck (43M+) and use it consistently; get founder sign-off on 40M "next four years".
  - Verify/soften "vetted ... real companies and real labs".
  - Move arbitrary sizes to scale tokens.

## Privacy page (`app/(marketing)/privacy/page.tsx`)
- **Purpose:** DPDP-oriented privacy policy.
- **Defects:**
  - `privacy/page.tsx:72-78` "**We do not yet send transactional email;** if we add it, we will name the provider here." Per launch-infra memory, email is LIVE via Resend (welcome, feedback-alert, weekly-digest). This is a factual error AND a DPDP processor-disclosure gap (Resend, a data processor handling email + personal data, is not named). High priority.
  - `privacy/page.tsx:101,104,133,136` contact email `collab2047.tech@gmail.com` (deck says `collab2047@gmail.com`) - same untraceable-address flag as Footer.
  - `privacy/page.tsx:74` "hosted in the Mumbai (ap-south-1) region in India" - specific infra claim; RUNTIME-CHECK the Supabase project region.
- **Missing states:** N/A (static).
- **A11y:** `#dpdp` anchor target with `scroll-mt-32` (good). Semantic h2 sections, list markup, mailto links. Clean.
- **Token violations:** none. `prose-legal` class used at line 26 - confirm it is defined (not in globals.css slice); RUNTIME-CHECK.
- **Copy flags:** "We do not yet send transactional email" (FALSE if Resend is live). "We do not sell your data / do not run ads" (consistent with manifesto). "aged 16 and above" (consistent with terms).
- **Verdict:** POLISH
- **Planned fix:**
  - Update the email section to name Resend (and its region/role) now that transactional email is live; this is a compliance fix, not cosmetic.
  - Centralise/verify the contact email.
  - Verify the Supabase region claim; confirm `prose-legal` exists.

## Terms page (`app/(marketing)/terms/page.tsx`)
- **Purpose:** Terms of use.
- **Defects:**
  - `terms/page.tsx:100,103` contact email `collab2047.tech@gmail.com` (deck mismatch, same as above).
- **Missing states:** N/A.
- **A11y:** semantic sections, list markup, mailto + internal links. Clean.
- **Token violations:** none. `text-[2.5rem]` (line 21) arbitrary size - minor.
- **Copy flags:** internally consistent (16+, entity name, governing law India). Only the email mismatch.
- **Verdict:** POLISH
- **Planned fix:** centralise/verify contact email; move `text-[2.5rem]` to a token.

## Login page (`app/(auth)/login/page.tsx` + `login/layout.tsx`)
- **Purpose:** Email/password sign-in + optional Google/phone-OTP.
- **Defects:**
  - `login/page.tsx:133-135` submit button is `disabled={loading}` but label stays "Sign in" during the POST - no pending label. Violates the "pending = disabled + label" standard. Same for Google (146-154), Send OTP (190-192), Verify (207-209).
  - `login/page.tsx:222-224` error block has no `aria-live` - screen readers are not notified when sign-in fails.
  - `login/page.tsx:107-124` email/password `Input`s pass `name` but no `autoComplete` (`email` / `current-password`) - hurts autofill + is a form-a11y gap.
  - `login/page.tsx:38,88` uses `location.href = "/home"` (full reload) rather than the router - acceptable but noted.
- **Missing states:** pending label absent (above); success = redirect (OK); failure = inline error (present but not announced).
- **A11y:** `Input` renders label+`htmlFor` (good). Disabled Google fallback has `aria-label` + `title` (good). Missing: `aria-live` on error, `autoComplete` on fields.
- **Token violations:** `text-[11px]` on the "Coming soon" badge (line 164) is below the caption token; ember error styling uses `bg-ember/10 text-ember` (on-system).
- **Copy flags:** "Sign in to your portfolio. Pick up where you left off." - "portfolio" framing consistent with manifesto/product. Clean.
- **Verdict:** POLISH
- **Planned fix:**
  - Add pending labels ("Signing in...", "Sending...", "Verifying...").
  - Add `aria-live="assertive"` (or `role="alert"`) to the error paragraph.
  - Add `autoComplete="email"` and `autoComplete="current-password"`.
  - Replace `text-[11px]` with a caption/token size.

## Signup page (`app/(auth)/signup/page.tsx` + `signup/layout.tsx` + `signup/actions.ts`)
- **Purpose:** Email/password account creation (server action gate) + Google/phone.
- **Defects:**
  - `signup/page.tsx:140-142` "Create account" button is `disabled={loading || pending}` but the label never changes to a pending state.
  - `signup/page.tsx:229-231` error block has no `aria-live`.
  - `signup/page.tsx:122-139` email/password `Input`s have no `autoComplete` (`email` / `new-password`).
  - `signup/page.tsx:36-43` client checks password>=8 and email format before the transition (good), but there is no visible inline field-level error styling on the inputs themselves - only the shared error paragraph.
- **Missing states:** pending label absent; success = redirect to `/onboarding`; failure = inline error (not announced).
- **A11y:** labels good; disabled Google fallback labelled; missing `aria-live` + `autoComplete`.
- **Token violations:** `text-[11px]` badge (line 171).
- **Copy flags:** "Show what you actually do." + "For students, researchers, faculty, institutions and industry." (5-audience framing, consistent). Clean.
- **`actions.ts`:** solid - server-authoritative gate (format + disposable + MX via `checkSignupEmail`, then SSR `signUp`), documents the GoTrue bypass caveat honestly. KEEP.
- **Verdict:** POLISH
- **Planned fix:**
  - Add pending label to "Create account" (and OTP buttons).
  - Add `aria-live` to the error block; add `autoComplete` to inputs.
  - Consider marking the offending field (email/password) with the ember border on validation failure.

## Forgot-password page (`app/(auth)/forgot-password/page.tsx`)
- **Purpose:** Request password-reset email.
- **Defects:**
  - `forgot-password/page.tsx:85-93` email `Input` has no `autoComplete="email"`.
  - `forgot-password/page.tsx:105-109` error block has no `aria-live`.
- **Missing states:** pending label PRESENT ("Sending..."/line 100 - good), success state PRESENT (sent view, lines 48-74), failure inline (present, not announced). This is the correct pattern the auth pages should share.
- **A11y:** label good; "try again" and "Back to sign in" are real controls; missing `aria-live` + `autoComplete`.
- **Token violations:** none.
- **Copy flags:** "If an account exists ... a password reset link is on its way." (correct non-enumeration language) - clean and honest.
- **Verdict:** POLISH
- **Planned fix:** add `autoComplete="email"`; add `aria-live` to the error paragraph.

## Reset page (`app/(auth)/reset/page.tsx`)
- **Purpose:** Set new password after recovery link.
- **Defects:**
  - `reset/page.tsx:92-111` new/confirm password inputs have no `autoComplete="new-password"`.
  - `reset/page.tsx:123-130` error block has no `aria-live`.
  - `reset/page.tsx:22-35` on load, if `getUser()` finds no session it sets an error and leaves `ready=false` (inputs disabled) - good; but there is no loading indicator during the `getUser()` round-trip (brief disabled-empty state). Minor RUNTIME-CHECK.
- **Missing states:** pending label PRESENT ("Saving..."/line 118), success PRESENT (done view + redirect), failure inline (present, includes a "Request a new link" recovery link - good). Ready-gate handles the invalid-link case.
- **A11y:** labels good; missing `aria-live` + `autoComplete`.
- **Token violations:** none.
- **Copy flags:** clean ("Choose a password you will remember this time.").
- **Verdict:** POLISH
- **Planned fix:** add `autoComplete="new-password"` to both fields; add `aria-live` to the error paragraph; optional loading cue during session check.

## Onboarding page (`app/(auth)/onboarding/page.tsx` + `onboarding/actions.ts`)
- **Purpose:** Multi-step profile setup (type -> identity -> affiliation -> field -> details/role -> interests -> review) with server submit.
- **Defects:**
  - Toggle buttons do not expose selected state to assistive tech: account-type cards (`page.tsx:397-421`), title chips (`464-477`), branch chips (`581-594`), year chips (`642-654`), interest chips (`716-733`) all convey "selected" only via saffron background - none set `aria-pressed`. SR users cannot tell what is chosen.
  - `page.tsx:988-1004` server-error block (`state.error`) has no `aria-live`; `page.tsx:366-370` `errorMsg` (URL-param error) also not announced.
  - `page.tsx:445-456` name input, `484-498` handle input, `556-562` city, `612-619` branch-other, `662-668` birthday, `686-693` role - these bypass the shared `Input` primitive and re-implement styling inline; they DO have `htmlFor` labels and a saffron focus ring, but the duplication risks drift from the primitive.
  - `page.tsx:499-517` handle availability status text updates live but is not in an `aria-live` region, so "already taken" is silent to SR.
- **Missing states:** loading = handle-availability "Checking availability..." (present); pending = "Creating..." on submit (`page.tsx:1014-1016`, good); success = redirect; failure = inline `state.error` via `useActionState` that preserves all fields (good, documented). Empty/guard states handled by `canContinue`.
- **A11y:** respects reduced motion via `useReducedMotion()` on all `motion` transitions (`page.tsx:161,378-381,600-603` - good). Progress bar is decorative + backed by "Step X of Y" text (good). Gaps: `aria-pressed` on all toggle groups; `aria-live` on error + handle-status.
- **Token violations:** none hardcoded - inline inputs use `border-ink/15`, `focus:ring-saffron/20`, `border-ember` (all on-system tokens).
- **Copy flags:** option data is neutral/generic (no invented personal data); "collab47.com/u/username" matches the live domain. Clean.
- **`actions.ts`:** strong - RETURNs errors (never redirects on validation, documented "username taken" bug fix), validates type/name/handle/reserved/interests, moderates free-text, maps fields to columns without fabrication. KEEP.
- **Verdict:** POLISH
- **Planned fix:**
  - Add `aria-pressed={active}` to every toggle button group (type, title, branch, year, interests).
  - Wrap the submit-error and handle-status text in `aria-live` regions (`polite` for status, `assertive`/`role="alert"` for errors).
  - Consider routing the inline inputs through the `Input` primitive (after the primitive gains a focus-visible ring) to stop styling drift.

## PublicTopNav (`components/layout/PublicTopNav.tsx`)
- **Purpose:** Server-component top nav for public-but-authable pages; marketing `Nav` when signed out, app nav + avatar + bell when signed in.
- **Defects:**
  - `PublicTopNav.tsx:78-89` notification bell link is `p-2.5` around a `size-4` icon ~= 40px hit area, below the 44px tap floor.
  - `PublicTopNav.tsx:90-97` avatar link uses `Avatar size="sm"` - verify rendered size >= 44px tap target. RUNTIME-CHECK.
- **Missing states:** signed-in/out branch handled from the auth session (correct, documented). Unread badge computed server-side.
- **A11y:** bell link has `aria-label="Notifications"`, profile link `aria-label="Your profile"` (good). Nav links have text + icon.
- **Token violations:** none (opacity-modified tokens only).
- **Copy flags:** none (nav labels only). Clean.
- **Verdict:** POLISH
- **Planned fix:** bump the bell to `.tap`/`p-3` for a 44px target; verify avatar tap size.

## PublicTopNavMobile (`components/layout/PublicTopNavMobile.tsx`)
- **Purpose:** Hamburger sheet exposing app nav on small screens for signed-in public pages.
- **Defects:** none material. Documents why links/icons are re-declared client-side (server->client function-prop 500) - good.
- **Missing states:** N/A.
- **A11y:** hamburger has `aria-label` + `aria-expanded` (good); body scroll locked on open; backdrop dismiss button; sheet links use `.tap`. No focus trap/Escape (same minor gap as landing Nav) - RUNTIME-CHECK.
- **Token violations:** none.
- **Copy flags:** none.
- **Verdict:** KEEP
- **Planned fix:** (optional) add Escape-to-close + focus move for parity.

## Root layout (`app/layout.tsx`)
- **Purpose:** Fonts (Newsreader/Inter/JetBrains/Noto Devanagari), metadata, viewport, Lenis provider, analytics.
- **Defects:** none. Serif = Newsreader (matches standard); comment honestly explains Newsreader chosen over Fraunces on descender metrics.
- **Missing states:** N/A.
- **A11y:** `lang="en-IN"`, theme-color set.
- **Token violations:** none.
- **Copy flags:** title/description = standard positioning line - traceable. Clean.
- **Verdict:** KEEP
- **Planned fix:** none. (Note: `app/globals.css:36` still calls the serif "Fraunces" in a comment though the token resolves to Newsreader - stale comment, fix for clarity.)

## not-found (`app/not-found.tsx`)
- **Purpose:** 404 page.
- **Defects:**
  - Uses inline `style={{...}}` with `var(--color-*)` throughout instead of Tailwind utility classes - on-token but off-pattern vs. the rest of the app; harder to maintain.
  - No `<Nav>`/`<Footer>` chrome - a bare page; RUNTIME-CHECK whether that is intended (feels orphaned vs. marketing pages).
- **Missing states:** N/A.
- **A11y:** semantic h1, real "Back to home" link with `.tap`.
- **Token violations:** none (all values are `var(--color-*)` / `var(--text-*)` tokens).
- **Copy flags:** "This page wandered off." / "back to where the collaboration happens." - on-brand, no false claims. Clean.
- **Verdict:** POLISH
- **Planned fix:** convert inline styles to utility classes for consistency; decide whether to add Nav/Footer chrome.

---

## Cross-cutting

1. **`SplitWords` ignores `prefers-reduced-motion`** (`components/motion/SplitWords.tsx:29-46`). Unlike `Reveal`/`Stagger` (which guard with `useReducedMotion()`) and unlike onboarding (which guards), `SplitWords` always runs the `y:110%->0%` reveal. motion/react uses inline transforms, so the global CSS reduced-motion safety net in `globals.css:286-295` does NOT catch it. Affects Hero H1 and About H1. Single-file fix, high impact.

2. **`MagneticButton` and Lenis smooth-scroll ignore reduced motion.** `MagneticButton.tsx` translates on pointer move with no reduced-motion guard (Hero CTA). `LenisProvider.tsx` enables JS smooth scroll on `/` and `/about` with no `useReducedMotion()`/media-query check, and issues animated `lenis.scrollTo` for anchor jumps - reduced-motion users still get 1.1-1.2s eased scrolling. RUNTIME-CHECK + fix both.

3. **Async-action pending labels are inconsistent.** forgot-password ("Sending..."), reset ("Saving..."), onboarding ("Creating...") flip the label; login ("Sign in") and signup ("Create account") only disable, never relabel - violating the "pending = disabled + label" standard. Standardise all submit buttons; the `Button` primitive has no built-in pending/`loading` prop, so this is re-solved ad hoc each time - add one to `components/primitives/Button.tsx`.

4. **Auth error blocks lack `aria-live`.** login, signup, reset, forgot-password, and onboarding all render errors in a plain `<p>` with no live region, so SR users are never told a submit failed. Only `CTABand` gets `aria-live` right. Add `role="alert"`/`aria-live` everywhere errors surface.

5. **Inputs miss `autoComplete`.** No auth form sets `autoComplete` (email/current-password/new-password), and the `Input` primitive (`components/primitives/Input.tsx`) simply spreads props with no defaults. Add the attributes at each call site.

6. **`Input` primitive kills the focus-visible ring.** `Input.tsx:22` sets `focus:outline-none` and only changes `border-ink` on focus, overriding the global saffron `:focus-visible` outline (`globals.css:278-282`) - the visible keyboard-focus indicator on shared inputs is reduced to a subtle 1px border change. The onboarding inline inputs do better (`focus:ring-2 focus:ring-saffron/20`). Give the primitive a proper focus ring. RUNTIME-CHECK contrast.

7. **`Button` primitive has no default `type`.** `components/primitives/Button.tsx:38-52` never sets `type`, so a `<Button>` inside a `<form>` defaults to `type="submit"`. Call sites mostly pass `type` explicitly, but this is a latent accidental-submit bug (e.g. the onboarding "Add" custom-interest button correctly passes `type="button"` - others rely on not being inside a form). Default it to `"button"`.

8. **Arbitrary type sizes bypass the scale token system** in nearly every headline: `text-[2.6rem]` (Hero), `text-[2.1rem]` (Problem/Product), `text-[2.5rem]`/`text-[2rem]`/`text-[2.25rem]`/`text-[1.85rem]` (About, manifesto, privacy, terms, CTABand), `text-[0.95rem]` (Nav), `text-[11px]` (login/signup badges). These are used as a mobile-clamp before switching to `text-display-*` at `sm:`. Defensible pattern but off-system; consider `clamp()`-based scale tokens (e.g. `--text-display-sm`) so mobile sizes live in the token layer. No serif `leading` value violates the 1.16 floor - all observed are 1.16-1.25.

9. **Contact email drift.** `collab2047.tech@gmail.com` is hardcoded in 3 files (Footer, privacy x2, terms) and disagrees with the deck's `collab2047@gmail.com`. No single source of truth. Confirm the canonical address and centralise it.

10. **Copy-honesty theme - present-tense capability claims not in the deck.** The deck marks NO feature as live; the site repeatedly asserts current capability: Product "what you can do on Collab47 today" + "smart feed ranks", manifesto "career impact engine"/"anti bias layer"/"vetted ... real companies and real labs", About "Vernacular ... first", privacy "we do not yet send transactional email" (contradicted by live Resend). Every one needs verification against the running app before launch; several are likely false as written. This is the single largest risk cluster in the slice.

11. **Two hardcoded off-token colour usages** (only these two in the whole slice): `Nav.tsx:40` `rgba(10,15,28,0.04)` shadow. Everything else uses palette tokens or opacity-modified tokens correctly. (Also: `globals.css:33` defines `--color-gold: #B45309`, which is not in the locked palette list - unused in this slice, noted for the token owner.)

12. **Mobile sheets lack focus management** (landing `Nav`, `PublicTopNavMobile`): body-scroll lock is handled, but no focus move into the sheet and no Escape-to-close. Consistent minor a11y gap worth fixing once.

---

## Summary

- **Total defects found:** ~48 discrete issues across 22 files (counting each bulleted defect; excludes the 12 cross-cutting patterns which aggregate many of them).
- **Worst 5:**
  1. Privacy policy states "We do not yet send transactional email" while Resend email is live (welcome/digest/feedback) - factual error + DPDP processor-disclosure gap. `privacy/page.tsx:72-78`.
  2. `SplitWords` ignores `prefers-reduced-motion`, animating the Hero and About H1 for reduced-motion users. `SplitWords.tsx:29-46`.
  3. Manifesto asserts invented, present-tense product capabilities ("career impact engine", "anti bias layer") and uses unsourced, self-contradictory student figures (80M vs 40M vs deck 43M). `manifesto/page.tsx:105,133-136,147`.
  4. Login + Signup submit buttons never show a pending label (disable only), and all auth error blocks lack `aria-live` - a11y + the standard's pending requirement. `login/page.tsx:133-135,222`; `signup/page.tsx:140,229`.
  5. Problem section states "95% of India's talent sits outside the top fifty institutions" - specific unsourced statistic not traceable to the deck. `Problem.tsx:9`.
- **Verdict counts:** KEEP = 5 (landing page.tsx, Quote, PublicTopNavMobile, layout.tsx, + signup/onboarding server actions counted within their pages); POLISH = 17; REBUILD = 0.
  - Page/component verdicts: KEEP - Landing page, Quote, PublicTopNavMobile, layout.tsx. POLISH - Nav, Hero, Problem, Product, CTABand, Footer, About, Manifesto, Privacy, Terms, Login, Signup, Forgot-password, Reset, Onboarding, PublicTopNav, not-found. REBUILD - none.
