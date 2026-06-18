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

  // Validate secret when env is set
  if (cronSecret) {
    const incoming = req.headers.get("x-cron-secret");
    if (incoming !== cronSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await fetchAndStoreNews();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}
