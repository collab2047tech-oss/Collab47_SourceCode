# Collab47 setup runbook

Order matters. Follow top to bottom. ~60 minutes total once accounts exist.

## 1. Create Supabase project (5 min)

1. Sign in at [supabase.com](https://supabase.com) with the founders' shared email.
2. New project. Name: `collab47-prod`. Region: **Mumbai (ap-south-1)**. Generate a strong DB password and save it in the team password manager.
3. Wait ~2 min for provisioning.
4. From Project Settings → API:
   - Copy `Project URL` → goes into `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key → goes into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → goes into `SUPABASE_SERVICE_ROLE_KEY` (server only, never to browser)

## 2. Set env vars locally (1 min)

```bash
cd collab47-web
cp .env.example .env.local
# paste the three values from step 1 into .env.local
```

Restart the dev server so Next reads them: `npm run dev`.

## 3. Run schema migrations (5 min)

In Supabase Studio → SQL Editor, paste each file in order and run:

1. `supabase/migrations/0001_init.sql` (tables + indexes + triggers)
2. `supabase/migrations/0002_rls.sql` (Row-Level Security on every table)
3. `supabase/migrations/0003_views_and_jobs.sql` (materialised views + admin queue)

Then in Database → Extensions, enable: `pgvector`, `uuid-ossp`, `pgcrypto`, `pg_cron`.

## 4. Enable Google OAuth provider (5 min)

1. In Supabase Studio → Authentication → Providers → Google → Enable.
2. Open Google Cloud Console → API & Services → Credentials → Create Credentials → OAuth client ID → Web application.
3. Add authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase shows this exact URL).
4. Copy the `Client ID` + `Client Secret` back into Supabase Google provider settings.
5. Save.

## 5. Enable Phone OTP via MSG91 (10 min)

1. Sign up at [msg91.com](https://msg91.com) with the founders' shared email.
2. KYC: upload company PAN (or proprietorship docs).
3. Buy DLT-registered Sender ID. (TRAI rule. Mandatory in India.)
4. Get API key from MSG91 dashboard.
5. In Supabase Studio → Authentication → Providers → Phone → Enable.
6. Select SMS provider: **MSG91**. Paste API key + sender ID + template ID.
7. Top up ~₹500 to start.

## 6. Configure email (5 min)

1. Sign up at [resend.com](https://resend.com), free tier.
2. Verify the sending domain (add DNS TXT/CNAME records via Cloudflare).
3. In Supabase Studio → Authentication → Email Templates, switch SMTP from Supabase default to Resend SMTP using the resend credentials.

## 7. Configure Supabase Storage buckets (3 min)

In Supabase Studio → Storage → New bucket:

| Bucket | Public | Notes |
|---|---|---|
| `avatars` | yes | Profile photos |
| `covers` | yes | Profile cover strips |
| `post-media` | yes | Post images + videos |
| `message-media` | no | DM attachments (signed URLs) |

Then add RLS policies: read public for the first three, authenticated insert with `auth.uid()::text` as the path prefix.

## 8. Deploy to Vercel (5 min)

1. Push the repo to GitHub.
2. Sign in at [vercel.com](https://vercel.com) with GitHub.
3. Import the repo. Framework auto-detects Next.js.
4. Paste the three Supabase env vars (same as `.env.local`) into Vercel Project Settings → Environment Variables.
5. Deploy. First deploy takes ~90 seconds. Note the `https://<project>.vercel.app` URL.

## 9. Connect domain via Cloudflare (5 min)

1. In Cloudflare DNS for `collab47.com`, add a CNAME record: `@` → `cname.vercel-dns.com`. Proxy status: **DNS only** for the apex (Vercel requires it).
2. Add a CNAME: `www` → `cname.vercel-dns.com`. Proxy status: **DNS only**.
3. In Vercel Project Settings → Domains, add `collab47.com` and `www.collab47.com`. Vercel issues the SSL certificate automatically in 1-2 min.

## 10. Smoke test (5 min)

Open `https://collab47.com`:

1. Click "Sign up" → "Continue with Google" → complete consent → land on `/onboarding`. Fill all 5 steps. End on `/home`.
2. Confirm one row exists in Supabase Table Editor → `auth.users`. One row in `public.profiles` with `onboarded = true`.
3. Sign out from `/settings`. Sign back in with phone number → enter OTP → land on `/home`.
4. Try a gated route while signed out (`/profile`): should redirect to `/login`.

## 11. Cron jobs

Once `pg_cron` is enabled, run in SQL Editor:

```sql
select cron.schedule('refresh-popular',  '*/10 * * * *', 'refresh materialized view concurrently public.popular_posts');
select cron.schedule('refresh-trending', '*/10 * * * *', 'refresh materialized view concurrently public.trending_posts');
select cron.schedule('purge-seen-posts', '0 4 * * *',    'delete from public.user_seen_posts where seen_at < now() - interval ''7 days''');
select cron.schedule('expire-posts',     '0 * * * *',    'update public.posts set image_urls = ''{}'', video_url = null where expires_at is not null and expires_at < now() and not is_highlight');
```

## 12. Apply credits

| Program | Apply at | Approval |
|---|---|---|
| Google for Startups Cloud Program | [cloud.google.com/startup](https://cloud.google.com/startup) | 1 week, get $2K up to $100K |
| AWS Activate | [aws.amazon.com/activate](https://aws.amazon.com/activate) | 1 week, get $1K up to $5K |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/onboarding` 500s on submit | `profiles` row missing. Check the `auth.users` row exists, then re-run signup. |
| Google OAuth redirects to error | Mismatch between Google Console redirect URI and Supabase callback URL. Re-paste exact URL. |
| Phone OTP not received | MSG91 sender not DLT-approved yet, or template missing. Check MSG91 dashboard. |
| `dev` server says "Supabase not configured" | `.env.local` missing or dev server not restarted after the file was added. |
| RLS error on profile insert | Trigger missing or `auth.uid()` is null. Confirm the user is signed in. |

End of runbook.
