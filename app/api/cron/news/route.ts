/**
 * Cron trigger route. Hit by Supabase pg_cron or cron-job.org hourly.
 * GET /api/cron/news
 * Header: x-cron-secret: <value of CRON_SECRET env>
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAndStoreNews } from "@/lib/news/fetch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: never run an unauthenticated fetch in production.
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  // Accept our header (GitHub Action) or Vercel's built-in cron bearer token.
  const incoming = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  if (incoming !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await fetchAndStoreNews();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}
