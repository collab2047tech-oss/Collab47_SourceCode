/**
 * Cron trigger route for the reference directories.
 * GET /api/cron/directory
 * Header: x-cron-secret: <CRON_SECRET>   (or Vercel's Authorization: Bearer)
 *
 * Runs the directory sync (bootstrap + data.gov.in when a key is set) and returns
 * per-source { fetched, upserted, skipped, error }. Auth pattern is copied
 * verbatim from app/api/cron/news/route.ts so Vercel's cron invocation matches.
 */
import { NextRequest, NextResponse } from "next/server";
import { runDirectorySync } from "@/lib/directory/sync";
import { cronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: never run an unauthenticated sync in production.
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  // Accept our header (GitHub Action) or Vercel's built-in cron bearer token.
  if (!cronAuthorized(req, cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDirectorySync({ signal: req.signal });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}
