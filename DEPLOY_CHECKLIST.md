# Collab47 — Deploy Checklist (run only after local testing is approved)

Do NOT deploy until the app is tested + approved on localhost. These steps are
the launch sequence; nothing here runs automatically.

## 1. Auth providers (Supabase dashboard -> Authentication -> Providers)
- [ ] Google OAuth: paste Client ID + Secret. Authorised redirect URI is shown there.
- [ ] Phone: set MSG91 as the SMS provider (Auth key / Sender ID / Template) once DLT clears.
- [ ] Email/password stays enabled (current launch auth).

## 2. pg_cron jobs (Supabase -> Database -> Extensions: enable pg_cron, then run)
The feed already computes For-You / Popular / Trending + item-CF + PageRank LIVE per request,
so no cron is required for relevance. These crons are optimisations / housekeeping:
- [ ] Hourly news fetch is handled by the GitHub Action (set repo secrets below) — or schedule
      `select cron.schedule('news','0 * * * *', $$ ... call /api/cron/news ... $$)`.
- [ ] 14-day hard purge of soft-deleted accounts:
      `select cron.schedule('purge','0 3 * * *', $$ delete from auth.users u using public.profiles p
        where p.id=u.id and p.deleted_at < now() - interval '14 days' $$);`
- [ ] Optional: refresh popular/trending materialised views every 10 min (only if you switch the
      live functions to the matviews).

## 3. GitHub Action secrets (repo -> Settings -> Secrets -> Actions)
- [ ] NEWS_CRON_URL = https://<prod-domain>/api/cron/news
- [ ] NEWS_CRON_SECRET = the CRON_SECRET value from .env.local

## 4. Hosting
- [ ] Vercel: import the repo, set ALL env vars from .env.local (Supabase URL/anon/service_role,
      ADMIN_HANDLES, CRON_SECRET, RESEND_API_KEY, all NEWS_* + GROQ_API_KEY). Deploy.
- [ ] Cloudflare: add collab47.com, point nameservers, add the Vercel CNAME.

## 5. Final env / secrets sanity
- [ ] .env.local is gitignored (verified) — never committed.
- [ ] service_role key only in server env (Vercel), never NEXT_PUBLIC.
- [ ] Rotate any key that was ever pasted into chat.

## Deferred (post-launch, documented — not fake-shipped)
Web push, weekly email digest (Resend), Cloudflare AI toxicity (Groq Llama-Guard covers create-time),
vector/embedding semantic search (replaced by classical BM25/FTS by design), Louvain clustering,
video transcoding, materialised-view cron.
