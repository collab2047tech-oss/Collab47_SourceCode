"use server";

import { getSupabaseServer } from "@/lib/supabase/server";

type Kind = "impression" | "dwell" | "click" | "expand" | "profile_click" | "save" | "skip" | "hide";
const VALID: Kind[] = ["impression", "dwell", "click", "expand", "profile_click", "save", "skip", "hide"];

export interface FeedEventInput {
  postId: string;
  kind: Kind;
  value?: number; // e.g. dwell milliseconds
}

/**
 * Record real feed interaction events - the behavioural fuel that powers
 * engagement-rate, dedup ("seen"), and the learned ranker. Fire-and-forget from
 * the client (IntersectionObserver beacons). User-scoped by RLS.
 */
export async function recordFeedEventsAction(
  events: FeedEventInput[]
): Promise<{ ok: boolean }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false };

  const clean = (events ?? [])
    .filter((e) => e && e.postId && VALID.includes(e.kind))
    .slice(0, 200);
  if (clean.length === 0) return { ok: true };

  // 1. Append the raw events.
  await sb.from("feed_events").insert(
    clean.map((e) => ({ user_id: user.id, post_id: e.postId, kind: e.kind, value: Math.max(0, Math.min(e.value ?? 0, 600000)) }))
  );

  // 2. For impressions: bump the post's real impression counter (SECURITY DEFINER
  //    fn, since the viewer is not the author) and mark it seen (dedup).
  const impressionIds = [...new Set(clean.filter((e) => e.kind === "impression").map((e) => e.postId))];
  if (impressionIds.length > 0) {
    await sb.rpc("bump_impressions", { ids: impressionIds });
    await sb
      .from("user_seen_posts")
      .upsert(
        impressionIds.map((post_id) => ({ user_id: user.id, post_id })),
        { onConflict: "user_id,post_id", ignoreDuplicates: true }
      );
  }

  return { ok: true };
}
