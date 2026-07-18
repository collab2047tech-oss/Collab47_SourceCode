/**
 * Weekly email digest cron. Sends each eligible member a summary of the week
 * (new followers, connection requests, top posts from their network, community).
 * GET /api/cron/digest  Header: x-cron-secret OR Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security/cron-auth";
import { runWeeklyDigest } from "@/lib/email/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (!cronAuthorized(req, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runWeeklyDigest();
  return NextResponse.json(result);
}
