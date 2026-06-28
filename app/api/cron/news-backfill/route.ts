/**
 * One-off backfill route. Upgrades the existing summary-less / raw-blurb tail to
 * a real Groq summary + honest summary_status, and (re)computes reader-facing
 * topics. Cron-secret protected (mirrors /api/cron/news). Run once; afterwards
 * it idles because there is nothing left in ('raw','none').
 *
 * GET /api/cron/news-backfill
 * Header: x-cron-secret: <CRON_SECRET>   (or Authorization: Bearer <CRON_SECRET>)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";
import { summariseArticle, groqConfigured } from "@/lib/news/summarise";
import { tagArticle } from "@/lib/news/tagger";
import { branchToTopics } from "@/lib/news/topics";
import type { NewsSummaryStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many rows to upgrade per invocation (bounded for the serverless budget /
// Groq rate limits). Re-hit the route until `remaining` is 0.
const BATCH = 80;
const CONCURRENCY = 6;

interface Row {
  id: string;
  title: string;
  excerpt: string | null;
  summary: string | null;
  image_url: string | null;
}

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
    return NextResponse.json({ error: "no service role" }, { status: 500 });
  }
  if (!groqConfigured()) {
    return NextResponse.json({ error: "GROQ not configured" }, { status: 500 });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Pull a batch of rows that still carry a raw blurb or nothing.
  const { data, error } = await client
    .from("news_items")
    .select("id, title, excerpt, summary, image_url")
    .in("summary_status", ["raw", "none"])
    .order("published_at", { ascending: false })
    .limit(BATCH);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data as Row[] | null) ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, remaining: 0 });
  }

  let updated = 0;
  let i = 0;
  async function worker() {
    while (i < rows.length) {
      const r = rows[i++];
      const text = (r.summary || r.excerpt || r.title).trim();
      const groq = await summariseArticle({ title: r.title, text });

      let summary: string | null = null;
      let status: NewsSummaryStatus = "none";
      if (groq) {
        summary = groq;
        status = text.length >= 80 ? "ai" : "headline";
      } else if (text) {
        summary = text.slice(0, 600);
        status = "raw";
      }
      if (!summary) continue;

      const tags = tagArticle(r.title, summary);
      const topics = branchToTopics(tags.branch_tags, r.title, summary);
      const { error: upErr } = await client
        .from("news_items")
        .update({ summary, summary_status: status, topics, branch_tags: tags.branch_tags })
        .eq("id", r.id);
      if (!upErr) updated += 1;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Count what's left so the caller knows whether to re-run.
  const { count } = await client
    .from("news_items")
    .select("id", { count: "exact", head: true })
    .in("summary_status", ["raw", "none"]);

  return NextResponse.json({ ok: true, updated, remaining: count ?? 0 });
}
