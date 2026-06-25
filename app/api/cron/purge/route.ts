/**
 * Purge cron. Hard-deletes data that has aged out, so the DB doesn't bloat
 * forever (pg_cron is not enabled on this project, so this runs as a Vercel cron).
 *   - Expired reposts (is_repost = true AND expires_at < now): the 24h ephemeral
 *     repost rows. The feed already hides them; this reclaims the rows.
 *   - Soft-deleted posts older than 14 days (deleted_at < now-14d).
 *   - Soft-deleted accounts older than 14 days (profiles.deleted_at < now-14d):
 *     deleting the auth user cascades the profile + all their content.
 *
 * GET /api/cron/purge   Header: x-cron-secret OR Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const incoming = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  if (incoming !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const cutoff14 = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const result: Record<string, number | string> = {};

  // 1. Expired reposts.
  const { count: reposts } = await admin
    .from("posts")
    .delete({ count: "exact" })
    .eq("is_repost", true)
    .lt("expires_at", now);
  result.expired_reposts = reposts ?? 0;

  // 2. Soft-deleted posts past the 14-day grace window.
  const { count: oldDeletedPosts } = await admin
    .from("posts")
    .delete({ count: "exact" })
    .lt("deleted_at", cutoff14);
  result.purged_posts = oldDeletedPosts ?? 0;

  // 3. Soft-deleted accounts past the grace window -> delete the auth user
  //    (cascades the profile + all content via ON DELETE CASCADE).
  const { data: goneUsers } = await admin
    .from("profiles")
    .select("id")
    .lt("deleted_at", cutoff14)
    .limit(500);
  let purgedAccounts = 0;
  for (const u of goneUsers ?? []) {
    const { error } = await admin.auth.admin.deleteUser(u.id as string);
    if (!error) purgedAccounts++;
  }
  result.purged_accounts = purgedAccounts;
  result.ran_at = now;

  return NextResponse.json({ ok: true, ...result });
}
