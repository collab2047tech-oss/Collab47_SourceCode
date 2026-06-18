# Keys and accounts required

Direct links + exactly what to copy. Send order at the bottom.
Nothing is paid yet. Free tiers cover the build and launch.

---

## CRITICAL (unblocks go-live, do first)

### 1. Supabase project
- Link: https://supabase.com/dashboard/projects
- New project. Name `collab47-prod`. Region South Asia (Mumbai). Strong DB password (save it).
- After build (~2 min): Settings to API at https://supabase.com/dashboard/project/_/settings/api
- Copy 3 strings:
  - `Project URL` (e.g. https://abcdxyz.supabase.co) to env `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key (eyJ...) to env `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role secret` key (eyJ...) to env `SUPABASE_SERVICE_ROLE_KEY` (secret, send privately)

This is the only thing blocking live mode. Send these 3 first.

---

## NEEDED for full features

### 2. Google OAuth (Continue with Google)
- Link: https://console.cloud.google.com/apis/credentials
- Create Project "Collab47". Create Credentials to OAuth client ID to Web application.
- Authorised redirect URI: https://<project-ref>.supabase.co/auth/v1/callback (Supabase shows exact URL under Auth to Providers to Google)
- Copy 2 strings: `Client ID` + `Client Secret`
- Paste them INTO Supabase to Auth to Providers to Google. Then confirm done.

### 3. MSG91 (phone OTP, DLT takes ~3 days, start now)
- Link: https://msg91.com
- Sign up. KYC with company or proprietor PAN. Apply for DLT Sender ID + SMS template.
- Copy when approved: `Auth Key` + `Sender ID` + `Template ID`
- Paste into Supabase to Auth to Providers to Phone (SMS provider MSG91).

---

## FREE credits + hosting (apply now, no blocker)

### 4. Google for Startups credits ($2K to $100K free)
- Link: https://cloud.google.com/startup/apply
- Confirm applied.

### 5. AWS Activate ($1K to $5K free)
- Link: https://aws.amazon.com/activate/
- Confirm applied.

### 6. Vercel (hosting, free)
- Link: https://vercel.com/signup
- Sign in with GitHub. Confirm account exists.

### 7. Cloudflare (DNS for collab47.com, free)
- Link: https://dash.cloudflare.com
- Add site `collab47.com`. Update nameservers at registrar to Cloudflare.
- Confirm done.

### 8. Resend (email, free)
- Link: https://resend.com/signup
- Verify domain. Copy `Resend API key` to env `RESEND_API_KEY` (add later).

---

## Env var map (where each key goes in .env.local)

| Key from | env var |
|---|---|
| Supabase Project URL | NEXT_PUBLIC_SUPABASE_URL |
| Supabase anon key | NEXT_PUBLIC_SUPABASE_ANON_KEY |
| Supabase service_role key | SUPABASE_SERVICE_ROLE_KEY |
| Founder handles for /queue admin | ADMIN_HANDLES (e.g. akshpreet,shaurya) |
| News cron secret (any random string) | CRON_SECRET |
| NewsAPI key (optional) | NEWS_API_KEY |
| Resend key (later) | RESEND_API_KEY |

Google OAuth + MSG91 keys are pasted into the Supabase dashboard, NOT into .env.local.

---

## Send order

1. Right now: Supabase 3 strings (URL + anon + service_role). Unblocks live mode.
2. Parallel: Google OAuth, MSG91 (DLT is slow, start today).
3. Background: GCP credits, AWS Activate, Vercel, Cloudflare, Resend.

## After Supabase keys land, I will

1. Paste keys to .env.local.
2. Give exact paste order for the 6 SQL migrations (you run them in Supabase SQL editor).
3. Create 4 storage buckets: avatars, covers, post-media, message-media.
4. Smoke test: signup to onboard to post to like to comment to DM to create project to apply.
5. Go or no-go for deploy to Vercel + Cloudflare DNS.
