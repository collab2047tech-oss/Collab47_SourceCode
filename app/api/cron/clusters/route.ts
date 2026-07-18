/**
 * Community-detection cron. Runs Louvain over the real follow + accepted-
 * connection graph and writes profiles.cluster_id, powering "people from your
 * cluster" suggestions. Weekly is plenty (communities move slowly).
 *
 * GET /api/cron/clusters   Header: x-cron-secret OR Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security/cron-auth";
import { computeAndStoreClusters } from "@/lib/clustering/computeClusters";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!cronAuthorized(req, cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await computeAndStoreClusters();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
