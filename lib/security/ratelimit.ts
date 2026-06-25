import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lightweight per-user write throttle. Counts the user's own recent rows in a
 * table over a sliding window and reports whether they are over the cap. Uses
 * the caller's RLS-scoped client (a user can always read their own rows), so no
 * extra table or infra is needed — real abuse protection, zero dependencies.
 *
 * Returns true when the action should be BLOCKED (limit exceeded).
 */
export async function overLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any>,
  opts: { table: string; userColumn: string; userId: string; windowSec: number; max: number },
): Promise<boolean> {
  const since = new Date(Date.now() - opts.windowSec * 1000).toISOString();
  const { count, error } = await sb
    .from(opts.table)
    .select("id", { count: "exact", head: true })
    .eq(opts.userColumn, opts.userId)
    .gte("created_at", since);
  if (error) return false; // fail-open: never block a legitimate user on a count error
  return (count ?? 0) >= opts.max;
}

/** Standard caps per write action (tuned for a student network, anti-spam). */
export const LIMITS = {
  post: { windowSec: 300, max: 15 },       // 15 posts / 5 min
  comment: { windowSec: 60, max: 20 },     // 20 comments / min
  message: { windowSec: 60, max: 40 },     // 40 messages / min
  report: { windowSec: 3600, max: 20 },    // 20 reports / hour
  follow: { windowSec: 60, max: 40 },      // 40 follows / min
} as const;

export const RATE_LIMITED = "You are doing that too fast. Please wait a moment and try again.";
