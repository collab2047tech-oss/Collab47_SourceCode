# 12 - Account + Settings Overhaul

Area owner: Account + Settings.
Scope:
- (a) Name + username (handle) change rate-limited to once every 7 days, with stored last-changed timestamps and a friendly, exact countdown message.
- (b) Public / Private profile (Instagram-style). Private = visitor sees ONLY basic info (banner, college/institution, profession/role, and counts: connections / posts / projects) but NOT the content (posts, project details). The account stays discoverable (search, suggestions, follow/connect button).
- (c) Settings page: make every section real, working, and world-class (Account, Privacy, Notifications, DM permissions, Handle, Language, Billing honesty, Account deletion, Logout).

Brand note for everything below: cobalt editorial. accent `saffron` = `#2C5BFF` (cobalt blue), text `ink` `#0A0F1C`, muted `ash` `#5A6A86`, borders `bone` `#DDE3EE`, bg `cream`/`paper`, success `moss` `#047857`, danger `ember` `#DC2626`. No em dashes. No Hindi-only text. Company = "Collab47 Technologies Private Limited", location "India".

---

## 1. CURRENT STATE (real code, file:line evidence)

### Files in scope
- `app/(app)/settings/page.tsx` - server page; loads `getMyProfile`, maps to `SettingsInitial`.
- `app/(app)/settings/actions.ts` - server actions: `updateAccountAction`, `updatePrivacyAction`, `updateNotificationPrefsAction`, `deleteAccountAction`, `signOutAction`.
- `components/composite/SettingsView.tsx` - the whole settings UI (Account, Privacy, Notifications, DMs, Language, Billing, delete/logout).
- `lib/db/profiles.ts` - `getProfileByHandle`, `getMyProfile`, `updateProfile`, `updatePrivacy`, `updateNotificationPrefs`, `deleteMyAccount`, `uploadProfileImage`.
- `app/u/[handle]/page.tsx` - public profile, the privacy enforcement point.
- `lib/db/social.ts` - `searchAll` (search/discovery), `getFollowState`, `getConnectionStatus`, `getMyConnections`.
- `supabase/migrations/0002_rls.sql`, `0006_profile_settings.sql`, `0009_security_hardening.sql` - RLS + privacy columns.
- `app/api/cron/purge/route.ts` - 14-day hard-delete cron.

### (a) Name / handle rate-limit: DOES NOT EXIST
- `updateProfile` in `lib/db/profiles.ts:81-138` updates `name` and `handle` with zero rate limiting. Handle is only format + uniqueness checked (`profiles.ts:117-129`). Name has no checks at all.
- There is NO `last_name_change_at` / `last_handle_change_at` column anywhere. `grep` for `name_changed | handle_changed | last_changed | changed_at` returns nothing in `lib app supabase`. So "once every 7 days" is completely unimplemented.
- The handle helper text claims uniqueness but the UI gives no hint that changes are limited (`SettingsView.tsx:206-209`).

### (b) Public / Private profile: PRESENT BUT WRONG SHAPE + NOT ENFORCED AT DB
The intended product behavior is Instagram-style (basic info + counts visible, content hidden, account still discoverable). The current code does NOT do this:

1. Wrong UX shape. `app/u/[handle]/page.tsx:103-126`: when `!isPublic && !isOwner`, the visitor gets a near-empty card: avatar, name, handle, one sentence ("This profile is private. Connect with X to see their work."), and a follow/connect button. It deliberately hides college, profession/role, and ALL counts. That is more restrictive than requested and also less useful than Instagram (which shows post/follower/following counts + bio on private accounts).

2. Privacy is UI-only and trivially bypassable. RLS makes a private user's data fully public:
   - `0002_rls.sql:28` `profiles_read_public ... using (true)` - every column of every profile is world-readable, including a private user's `bio`, `links`, `college`, etc.
   - `0009_security_hardening.sql:7-9` `posts_read_public ... using (deleted_at is null)` - ANY non-deleted post is readable by anyone. So a private account's posts are fully fetchable through the Supabase API (`getProfilePosts`, feed, `searchAll` posts branch at `social.ts:406`) regardless of the `/u/[handle]` UI block. The "privacy" is a curtain over an open window.
   - `getProfileByHandle` (`profiles.ts:5-10`) does `select("*")`, returning all columns to render the private card, so even the data sent to the client for a "private" page is the full row.

3. `searchable` vs `public_profile` are conflated in the label. `SettingsView.tsx:257` labels `searchable` as "Searchable by recruiters" - but the product requirement is that a PRIVATE account stays discoverable. The two toggles are independent today (`searchAll` at `social.ts:405` filters on `privacy->>searchable`, NOT on `public_profile`), which is actually the correct separation, but the UI does not explain it and the private profile page does not honor "still discoverable" (it dead-ends visitors).

4. No `is_private` typed column. Privacy lives inside a freeform `privacy jsonb` (`0006_profile_settings.sql:4-6`, default `{"public_profile": true, "searchable": true, "read_receipts": false}`). `public_profile: false` is the de-facto "private" flag. There is no first-class column, so RLS cannot cleanly reference it and the ranker/suggestions cannot index it.

### (c) Settings sections: mix of real and dead
- Account / Profile / Academic: REAL. `updateAccountAction` (`actions.ts:13-48`) -> `updateProfile`. Good `FormData.has()` partial-update logic (`actions.ts:16-34`) so the two forms do not wipe each other.
  - Dead-ish: the "Change in profile" button (`SettingsView.tsx:195-199`) links to `/profile/edit` for avatar, but the Avatar shown here is decorative and there's no inline upload. Acceptable, but should be made obviously a link.
- Privacy: REAL save path (`updatePrivacyAction` -> `updatePrivacy`, merge-preserving at `profiles.ts:157-172`). But only 3 toggles, and `read_receipts` is not actually consumed by the messages read-state code (needs verification by the messaging area; flagged as Open Question). `public_profile` toggle here is the ONLY way to go private but the label "Public profile" + a generic "Control who sees what" gives no preview of consequences.
- Notifications: HALF-REAL. `updateNotificationPrefs` persists prefs (`profiles.ts:179-209`). But nothing READS `notification_prefs` to gate email/push sending. `grep` shows no consumer of `notification_prefs`. So toggles save but change no behavior = a real-looking dead control. The "push" channel has no web-push registration anywhere. This is the biggest honesty problem in Settings.
- DM Permissions: REAL. `DmPermissionsSection` (`SettingsView.tsx:76-138`) -> `updateDmPermissionAction` (`messages/actions.ts:117-137`) writes `dm_permission`. Enforcement is in the messaging layer (out of this area's scope but should be cross-checked).
- Language: DEAD. `SettingsView.tsx:537-549` renders a single non-functional "English" button. No i18n exists. Honest but pointless as a "section."
- Billing: DEAD / FUTURE. `SettingsView.tsx:551-568` "Upgrade when premium opens" button does nothing. There is no billing system. This is fine as honest "Free plan" info but the CTA button is a fake affordance.
- Delete account: REAL soft-delete. `deleteMyAccount` (`profiles.ts:215-231`) sets `deleted_at`. Purge cron hard-deletes after 14 days (`api/cron/purge/route.ts:56-67`). BUT:
  - The confirm copy promises "You have 14 days to reverse this by signing back in" (`SettingsView.tsx:578-581`). There is NO restore-on-sign-in flow. `grep deleted_at` in auth/middleware finds nothing that un-sets `deleted_at` on login, and nothing that BLOCKS a soft-deleted user from using the app. So the promise is false and a "deleted" user can keep using the app normally until the cron nukes them. Honesty + correctness bug.
  - After delete, the client does `window.location.href = "/"` (`SettingsView.tsx:471`) but the session is NOT signed out, so they may bounce right back in.
- Logout: REAL. `signOutAction` (`actions.ts:96-100`).

### Contrast / blended issues in current Settings
- `text-ink/70` on nav items (`SettingsView.tsx:495`) is borderline; the active item is fine (`bg-ink text-cream`) but inactive uses 70% ink on cream which is acceptable but should be pinned to a named token for consistency.
- Toggle "Off" state `text-ash border-bone` on `bg-transparent` (`SettingsView.tsx:321-322`, `411`, `420`) is low-affordance - looks disabled. A switch with a visible track would read far better (see Target).
- `bg-saffron/5` selected DM card (`SettingsView.tsx:105`) is a 5% cobalt tint; fine for background but ensure the radio + text stay full-contrast `ink`.

---

## 2. TARGET (world-class + real, with real-system reference)

### (a) Name + handle change limit (reference: Instagram username 14-day rule, X handle limits)
- Both `name` and `handle` are independently rate-limited to one change per 7 days, tracked by `last_name_change_at` and `last_handle_change_at` columns.
- Server is the source of truth (UI hints are advisory only). On attempt within the window, return a friendly, exact message: "You can change your name again in 4 days (next change available on Jul 2)." No raw timestamps, no errors that look like a 500.
- The Settings UI shows the constraint proactively: a small `ash` helper line under each field "You can change this once every 7 days." When locked, the field is read-only with an inline note and the exact unlock date, exactly like Instagram greys the username field.
- First-ever set (value currently null/never changed) is always allowed and stamps the timestamp.

### (b) Public / Private profile (reference: Instagram private account)
Private profile, viewed by a non-owner who is NOT an accepted connection:
- VISIBLE: banner, avatar, display name, @handle, verified badge, profession/role (account_type label + role/branch), college/institution + city, and the three counts (Connections, Posts, Projects). A private lock chip ("Private profile"). The follow/connect/message actions.
- HIDDEN: bio? (Instagram shows bio on private; we will SHOW bio + links as "basic info," HIDE the post list, project details, and verified-contribution list). Replace the content region with a tasteful "This account is private" panel + "Connect to see their posts and projects."
- DISCOVERABLE: the account still appears in search, people-to-follow, suggestions, trending authors. Going private must NOT remove you from discovery. `searchable` is a SEPARATE, stronger opt-out ("Hide me from search and suggestions entirely").
- Accepted connections of a private user see the FULL profile (posts + projects), like Instagram followers.
- Enforced at THREE layers so it cannot be bypassed:
  1. UI (`/u/[handle]`) renders the private shell.
  2. Data layer: `getProfilePosts` / verified-projects fetch is gated server-side by a `canViewContent(viewerId, profile)` check before querying.
  3. RLS: posts SELECT policy denies non-owner, non-connection reads of a private author's posts (defense in depth, closes the API-bypass hole).

### (c) Settings, world-class (reference: LinkedIn Settings, Notion settings modal, Instagram settings)
- Two-column shell stays, but each section becomes a real, self-saving card with switch components, inline validation, and optimistic toggles.
- Privacy gets a clear "Private account" master switch at the top with a one-line consequence preview ("Only your connections can see your posts and projects. You stay discoverable in search."). Below it: "Hide from search and suggestions" (the `searchable` opt-out), "Read receipts."
- Notifications becomes honest: only show channels that actually do something. Email is real if/when wired; until then, group "In-app" (always on, real) and clearly mark Email/Push as "Coming soon" OR remove Push until web-push exists. No toggle may claim to do something it does not.
- Language + Billing: keep as honest single-state panels, remove the fake CTA button on Billing (replace with "We will email you when premium opens." text, no dead button) OR turn the button into a real waitlist join. Language: keep English-only but remove the implication of a selector; state it plainly.
- Delete account: real 14-day grace WITH a working restore. On sign-in, a soft-deleted account inside the grace window is auto-restored (`deleted_at` cleared) with a toast "Welcome back, your account was restored." Outside the window it is gone. Confirm copy matches reality. Sign the user out immediately after delete.

---

## 3. STEP-BY-STEP PLAN (ordered, concrete)

### DB migration `0027_account_settings.sql` (new file in `supabase/migrations/`)
```sql
-- 0027_account_settings.sql
-- (a) Rate-limit tracking for name + handle changes.
alter table public.profiles
  add column if not exists last_name_change_at   timestamptz,
  add column if not exists last_handle_change_at timestamptz;

-- (b) First-class privacy flag, backfilled from the existing jsonb.
alter table public.profiles
  add column if not exists is_private boolean not null default false;
update public.profiles
  set is_private = (privacy->>'public_profile') = 'false'
  where privacy ? 'public_profile';

-- Helper: is `viewer` an accepted connection of `target`? SECURITY DEFINER so
-- RLS on connections does not blind the policy.
create or replace function public.is_connected(viewer uuid, target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.user_a_id = least(viewer,target) and c.user_b_id = greatest(viewer,target)))
  );
$$;

-- (b) Defense-in-depth RLS: a private author's posts are readable only by the
-- author or an accepted connection. Public authors unchanged.
drop policy if exists "posts_read_public" on public.posts;
create policy "posts_read_public" on public.posts for select using (
  deleted_at is null and (
    not exists (
      select 1 from public.profiles pr
      where pr.id = posts.author_id and pr.is_private = true
    )
    or author_id = auth.uid()
    or public.is_connected(auth.uid(), author_id)
  )
);
```
Notes:
- Keep `privacy.public_profile` in sync with `is_private` (write both in `updatePrivacy`) so nothing else breaks during transition; treat `is_private` as the source of truth going forward.
- The feed (`lib/db/feed.ts`) already filters posts; verify the new posts policy does not regress the home feed for public authors (it does not - the `not exists private` branch is true for public authors). Add a regression note for the feed area.

### Step 1 - Name + handle rate limit (file: `lib/db/profiles.ts`)
- Add a small helper `nextAllowedChange(lastAt: string | null): { allowed: boolean; nextAt: Date | null }` (7-day window).
- In `updateProfile` (`profiles.ts:81-138`):
  - Fetch the current row's `name`, `handle`, `last_name_change_at`, `last_handle_change_at` once at the top (single select).
  - If `payload.name` is present AND differs from current name: enforce window using `last_name_change_at`. If blocked, return `{ ok:false, error: friendlyMsg("name", nextAt) }`. If allowed and changed, set `updateFields.last_name_change_at = now`.
  - If `payload.handle` is present AND differs from current handle: run existing format+uniqueness checks, THEN enforce window using `last_handle_change_at`. If allowed and changed, set `updateFields.last_handle_change_at = now`.
  - Unchanged values must NOT consume the window (compare before stamping).
- `friendlyMsg(field, nextAt)` returns e.g. `You can change your ${field} again on ${formatINDate(nextAt)} (in ${daysLeft} days).` Use `toLocaleDateString("en-IN", { day:"numeric", month:"short" })`. No em dashes.

### Step 2 - Surface rate-limit state to the UI (files: `app/(app)/settings/page.tsx`, `SettingsView.tsx`)
- In `page.tsx`, extend `SettingsInitial` with `nameChange: { locked: boolean; nextAt: string | null }` and `handleChange: { locked: boolean; nextAt: string | null }`, computed from the profile's `last_*_change_at`.
- In `AccountSection` (`SettingsView.tsx:144-245`): under each of Full name and Handle, render the helper "You can change this once every 7 days." When `locked`, set the `Input` to `disabled`, add an inline `ash` note "Available again on {date}." Keep the server as the real gate (UI hint is advisory).

### Step 3 - Private profile data gating (files: `lib/db/profiles.ts`, `app/u/[handle]/page.tsx`)
- Add `getPublicProfileCounts(profileId)` to `lib/db/profiles.ts`: returns `{ connections, posts, projects }` using `head:true, count:"exact"` queries (follows/connections accepted count, posts where `deleted_at is null`, project_members count) so the private card can show real counts without leaking content. Reuse the same count pattern already used in `app/(app)/profile/page.tsx:32-36`.
- Add `canViewProfileContent(viewerId, profile)` helper: `profile.id === viewerId || !profile.is_private || (await is_connected via getFollowState)`.
- Rewrite the private branch in `app/u/[handle]/page.tsx:103-126` to the new Instagram-style shell:
  - Render the SAME banner + avatar + name + handle + verified + profession/role + college/city + social links (basic info) as the public header (extract the header into a small `ProfileHeader` block to avoid duplication).
  - Add a counts row (Connections / Posts / Projects) from `getPublicProfileCounts`.
  - Replace the posts + verified-projects region with a single bordered "This account is private" panel: lock icon, "Connect with {first name} to see their posts and projects," and the `ProfileActions` button.
  - Only call `getProfilePosts` / `getVerifiedProjectsForUser` when `canViewProfileContent` is true (skip the queries entirely for the private shell - perf + zero leak).
- Keep `getProfileByHandle` `select("*")` but the private branch must only pass the basic fields to client components; do not render bio/posts when gated. (Bio is allowed as basic info per Target; posts/projects are not.)

### Step 4 - Discovery stays on for private accounts (files: `lib/db/social.ts`)
- `searchAll` people branch (`social.ts:405`) must continue filtering ONLY on `searchable` (not on `is_private`). Confirm and add a code comment: "Private accounts remain discoverable; only `searchable=false` hides a user from search/suggestions."
- People-to-follow / suggestions / trending authors (other areas) should also gate on `searchable`, not `is_private` - leave a cross-area note. This honors the Target "still discoverable."

### Step 5 - Privacy section rebuild (file: `SettingsView.tsx` PrivacySection 261-338, `actions.ts`, `profiles.ts`)
- Replace the 3-row toggle list with:
  1. A prominent "Private account" master switch (maps to `is_private` / `public_profile`). Below it, a live `ash` consequence line: "Only your connections can see your posts and projects. You stay discoverable in search."
  2. "Hide from search and suggestions" switch (maps to `searchable`, inverted in copy).
  3. "Read receipts in messages" switch (maps to `read_receipts`) - keep only if the messaging layer reads it (see Open Questions); otherwise mark "Coming soon" and disable.
- `updatePrivacyAction` (`actions.ts:50-62`) + `updatePrivacy` (`profiles.ts:144-173`): write BOTH `privacy.public_profile` AND the new `is_private` column (kept in sync) inside one update. Keep the merge-preserving read.

### Step 6 - Honest Notifications (file: `SettingsView.tsx` NotificationsSection 352-440)
- Until email/push are actually wired, restructure to: an always-on "In-app" column (real - notifications table already exists) and Email/Push marked "Coming soon" (disabled, `ash`, with a tooltip), OR remove Push entirely. Do not present a toggle that does nothing as if it works.
- Keep persistence (`updateNotificationPrefs`) so when email IS wired, prefs already exist. Add a code comment in `profiles.ts:179` noting "prefs are stored but only `in_app` is currently consumed."

### Step 7 - Language + Billing honesty (file: `SettingsView.tsx` 537-568)
- Language: keep one honest line "Collab47 is English at launch. More Indian languages are on the roadmap." Remove the standalone non-functional button styling that implies a selector; render as static text or a disabled chip clearly labeled current.
- Billing: remove the fake "Upgrade when premium opens" button (`SettingsView.tsx:563-565`). Replace with plain text "We will email you when premium opens." OR a real "Join the premium waitlist" that writes to a `waitlist` table (Open Question - prefer removing the dead button now).

### Step 8 - Account deletion: make the promise true (files: `lib/db/profiles.ts`, auth callback/middleware, `SettingsView.tsx`, `actions.ts`)
- After `deleteMyAccount`, immediately `signOut` (call `signOutAction` server-side or have `deleteAccountAction` sign out before returning) so the session does not linger; then client redirects to `/`.
- Restore-on-sign-in: in the auth callback (`app/(auth)/callback` or the post-login server entry that loads the profile - confirm exact file), if the logged-in user's `profiles.deleted_at` is set AND within 14 days, clear `deleted_at` and show a "Welcome back, your account was restored" toast. If past 14 days the cron already removed them, so this is naturally a no-op.
- Block soft-deleted accounts from normal app use during the window EXCEPT for the sign-in restore path (a deleted user who logs in is offered restore; until restored they should not appear in feeds/search - `searchAll` already filters `deleted_at is null` at `social.ts:405`, good; verify feed filters too).
- Fix confirm copy in `SettingsView.tsx:578-581` to exactly match the implemented behavior (sign back in within 14 days to restore).

### Step 9 - Polish + contrast pass (file: `SettingsView.tsx`)
- Replace the pill "On/Off" buttons with a real switch component (track + knob), full-contrast in both states: on = `bg-saffron` knob white; off = `bg-bone` track, `ink` border, knob `paper`. Never rely on `text-ash` alone to signal state.
- Make every section auto-confirm with the existing "Saved." `moss` text but add optimistic switch movement (Step in Perf below).
- Pin inactive nav item color to a named contrast-safe value (e.g. `text-ink/80`).

---

## 4. OPTIMISTIC-UI / PERF NOTES (this area)

The founder reports ~1s lag per action. Settings actions today are `useTransition` + `await server action` + `revalidatePath` round-trips, so each toggle/save waits for the server before anything moves. Fixes:

- Every switch (Privacy, Notifications, DM, future toggles) flips INSTANTLY in local state on click (already partly true for the visual state), and the network save runs in the background. On failure, roll back the switch and show an inline `ember` "Couldn't save, try again." This removes the perceived wait entirely for toggles.
- Auto-save on toggle (debounced ~500ms) instead of a separate "Save privacy" button, matching Instagram/Notion. The explicit Save button can stay for the text fields (name/handle/academic) where a deliberate commit is expected.
- DM permission, privacy, and notification saves should NOT `revalidatePath("/settings")` on every change - that forces a server re-render and is a big part of the lag. Update local state optimistically; only revalidate the OTHER surfaces that actually changed (e.g. revalidate `/u/[handle]` when privacy flips so the public view updates), and do it without blocking the toggle animation.
- `/u/[handle]` private shell: skip the `getProfilePosts` + verified-projects + (when private) heavy queries entirely; only fetch counts (3 cheap `head:true` counts). This makes private profiles render faster than public ones.
- Name/handle save: optimistic field commit with the new value shown immediately; if the server rejects (rate limit), revert the field and show the friendly message. Pre-validate the 7-day window client-side from the `nextAt` passed in `SettingsInitial` so a locked field never even fires a request.
- Keep the Settings page itself client-cached on navigation (it is already `force-dynamic`; consider a lighter cache for the read since profile rarely changes, but correctness first).

---

## 5. HONESTY + CONTRAST NOTES (what to fix)

Fake / dead / misleading to fix:
- Notifications Email + Push toggles save but nothing reads `notification_prefs`; no web-push exists. Currently a fake feature. Fix: mark Email/Push "Coming soon" (disabled) or remove until wired; keep In-app real. (`SettingsView.tsx:344-440`, no consumer of `notification_prefs`.)
- Delete-account "reverse by signing back in" is a false promise; no restore flow and deleted users are not blocked. Fix in Step 8. (`SettingsView.tsx:578-581`, `profiles.ts:215-231`.)
- Billing "Upgrade when premium opens" is a dead button. Fix: remove or make a real waitlist. (`SettingsView.tsx:563-565`.)
- Language single button is non-functional. Fix: static honest text. (`SettingsView.tsx:537-549`.)
- Private profile privacy is UI-only and bypassable via the API (RLS `posts_read_public using(deleted_at is null)` at `0009:8-9`, `profiles_read_public using(true)` at `0002:28`). Fix with the RLS in migration `0027` + server-side gating (Step 3).
- "Searchable by recruiters" label (`SettingsView.tsx:257`) implies recruiter-specific behavior that does not exist; the toggle is a generic search/suggestions opt-out. Fix the copy to be accurate ("Hide from search and suggestions").

Contrast offenders to fix:
- Toggle "Off" pill: `text-ash border-bone bg-transparent` reads as disabled (`SettingsView.tsx:321-322, 411, 420`). Replace with a real switch with a visible track.
- Inactive nav `text-ink/70` (`SettingsView.tsx:495`) - bump to `text-ink/80` and verify on `cream`.
- Private card body text `text-ash` on `cream` (`SettingsView.tsx`/`u/[handle]:111-114`) - acceptable but the key sentence ("private") should be `ink`, which it already is; keep counts in `ink` not `ash`.

---

## 6. OPEN QUESTIONS for the founder

1. Connections vs followers for private visibility: Instagram uses followers. Collab47 has BOTH follows and accepted connections. Confirm: should a PRIVATE user's posts be visible to (a) accepted connections only, or (b) connections + followers? Plan currently assumes accepted connections only.
2. Does a private account's profile show bio + social links as "basic info," or should those also be hidden until connected? Plan currently shows bio + links (matches Instagram) and hides only posts/projects.
3. Read receipts: does the messaging layer actually consume `privacy.read_receipts` today? If not, do we wire it now or mark it "Coming soon"?
4. Notifications: is there any real email sending (Resend/Supabase) we can wire to, or do we ship In-app only and mark Email/Push "Coming soon"? Push needs web-push (VAPID) - in scope now or later?
5. Billing: remove the dead "Upgrade" button entirely, or replace with a real premium waitlist (new `waitlist` table)?
6. 7-day window: should name and handle share ONE 7-day window or be independent (plan = independent)? And is 7 days firm, or match Instagram's 14 days for username specifically?
7. Account deletion grace: confirm the 14-day window and that auto-restore on sign-in is the desired UX (vs an explicit "Reactivate" screen).
