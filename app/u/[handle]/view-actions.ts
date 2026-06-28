"use server";

import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Record that the current viewer looked at `targetId`'s profile. Dedup-per-day +
 * self-skip are handled inside the SECURITY DEFINER record_profile_view() RPC.
 * Best-effort: never throws to the UI.
 */
export async function recordProfileViewAction(targetId: string): Promise<void> {
  try {
    const sb = await getSupabaseServer();
    if (!sb) return;
    await sb.rpc("record_profile_view", { target: targetId });
  } catch {
    /* analytics is best-effort */
  }
}
