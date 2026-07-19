# Collab47 status and deployment

Last updated: 19 July 2026

---

## 1. Right now

| Thing | State |
|---|---|
| Live site `collab47.com` | Up and working, **running the OLD build** |
| Latest code | Committed and pushed to GitHub (`main`) |
| Deployed? | **No.** The Vercel token lost access, see below |
| Local dev | Working at `http://localhost:3000` with everything |

**Your live site is not broken.** It is simply serving the previous build. Nothing was lost.

---

## 2. Why the deploy is blocked

The Vercel token in `~/.collab47-cli-tokens` still authenticates, but it now has **no access to the `collab47` team**:

- `vercel whoami` -> `Not authorized: Trying to access resource under scope "collab47"`
- Vercel project API -> `HTTP 403`
- Teams visible to the token -> none

It worked earlier the same day, so the token was regenerated or its scope narrowed. This cannot be fixed from the CLI; a new token has to be minted from the Vercel dashboard.

### Fix it, pick one

**A. Add a GitHub secret (best: fixes it permanently)**
1. https://vercel.com/account/tokens -> **Create Token**
   **Scope must be the `collab47` team**, not "Personal Account". A personal token gets 403.
2. https://github.com/collab2047tech-oss/Collab47_SourceCode/settings/secrets/actions
   -> **New repository secret** -> name `VERCEL_TOKEN` -> paste.
3. Done. `.github/workflows/deploy-production.yml` then deploys automatically on every push to `main`. You can also trigger it by hand from the repo's **Actions** tab.

**B. Deploy once from your machine**
```bash
cd ~/Desktop/Colab47_Startup/collab47-web
npx vercel login      # browser login has the team access the token lost
npx vercel --prod
```

**C. Connect the Vercel project to GitHub**
https://vercel.com/collab47/collab47/settings/git -> connect `collab2047tech-oss/Collab47_SourceCode`.
Vercel then builds every push itself and workflow/token setup becomes unnecessary.

---

## 3. Rolling back

**Do not roll back via GitHub.** The commit before the current one predates all the launch infrastructure (SEO, email, web push, public news, clustering). Reverting there would undo far more than the recent UI work.

**Use Vercel Instant Rollback instead.** It is seconds, and it is exactly "the site as it was":

1. https://vercel.com/collab47/collab47/deployments
2. Pick the deployment you want to go back to
3. **... menu -> Promote to Production**

No code changes, no rebuild.

---

## 4. What is in the latest commit (not yet deployed)

**Branding**
- One shared `<Wordmark/>` replaces 13 hand-written wordmarks that had drifted into four different forms, including a typo shipping live as `COLLAB47 .`
- The real logo is now used across nav, sidebar, auth pages and mobile header
- Taglines corrected against the pitch decks: **Connect. Create. Succeed.** and the full **Where talent, innovation and opportunity converge.**
  (The old "Built for India. Built to Lead." appears in none of the brand documents.)

**Founders and equity**
- Removed from `/about` (founder grid, "Six founders." headline, the equity sentence) and `/manifesto` (founder count, funding lines)
- The manifesto signature is hidden behind a flag, not deleted

**Onboarding**
- **Fixed the state-wipe bug.** A taken username used to redirect, which remounted the page and erased every answer, dropping the user back on step 1. Errors are now returned and shown inline with all answers intact.
- Live username availability check while typing (`/api/handle-available`)
- Name and username prefilled from the Google identity
- "Where are you based?" now asked of all five account types (it was silently dropped for researchers, faculty and industry)
- Custom typed interests, de-duplicated and moderated
- Optional title: Mr / Mrs / Ms / Dr / Prof / Er (migration `0052`)

**Home and profile**
- Right rail cleared and reserved for advertising. Removed three expensive queries; the news one was fetching 300 rows to render 6.
- Social links hidden. The form and the server plumbing were disabled **together**, because hiding only the form would have erased every user's saved links on their next profile save.
- "Avatar" renamed to "Profile photo"

**Fixes**
- Top nav no longer clips its links on mid-width screens; it scrolls
- Feedback widget now appears on public pages too, not just inside the app shell

---

## 5. Already applied to production (server-side, live now)

These are live even though the build is not deployed, because they are configuration:

- **Supabase site URL corrected** to `https://collab47.com` (was still `collab47.vercel.app`)
- **Redirect allowlist** now includes `https://collab47.com/auth/callback` and `https://collab47.com/**`
  Without this, "Continue with Google" would have failed on the real domain.
- Migration `0052` (profile `title` column) applied
- Google provider enabled in Supabase

---

## 6. Still to do

**Product work**
- Login page redesign (LinkedIn-style)
- Colour re-skin to the logo palette. Exact values sampled from the logo file:
  - Brand orange `#D76202` (logo and large graphics only)
  - Accent orange `#B95402` (use for text and buttons: the logo orange fails WCAG contrast at 3.73:1, this passes at 4.85:1)
  - Green `#106434`
  - Navy `#03265E`

**After upgrading to Supabase Pro**
- **Custom auth domain.** Today the Google sign-in screen reads "to continue to `munpgkzcukoccoactszz.supabase.co`", which looks like gibberish to a new user right at the moment they are deciding to sign up. Fixing it needs Supabase's Custom Domain add-on (about $10/mo, Pro only) so the callback runs on `auth.collab47.com`. Setting an app name in Google alone does not fix it, because Google shows the domain where the OAuth flow terminates.
- Raise database limits and enable daily backups
- Re-enable email verification on signup if wanted (currently off by choice)
- **Weekly digest email + push notifications - verify end to end in production.**
  The infra already exists and is scheduled (Vercel cron `/api/cron/digest`
  Mondays 02:30 UTC; web push via VAPID; per-user opt-out toggle live in
  Settings writing `profiles.digest_opt_out`). What remains is confirming real
  delivery on the production domain and deciding push campaign content.

**Housekeeping**
- The Mac's disk hit 100% full during this work. Desktop alone is ~31 GB. Worth clearing.

---

## 7. Useful links

- Live site: https://collab47.com
- Vercel deployments: https://vercel.com/collab47/collab47/deployments
- Vercel tokens: https://vercel.com/account/tokens
- GitHub repo: https://github.com/collab2047tech-oss/Collab47_SourceCode
- GitHub secrets: https://github.com/collab2047tech-oss/Collab47_SourceCode/settings/secrets/actions
- Supabase auth config: https://supabase.com/dashboard/project/munpgkzcukoccoactszz/auth/url-configuration
- Admin feedback triage: https://collab47.com/feedback
