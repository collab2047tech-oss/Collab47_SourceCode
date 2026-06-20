import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Server-side admin check. The ONLY source of truth for moderation privilege.
 * Must be called inside every moderation server action / db function BEFORE any
 * service-role operation — the admin route layout only guards page rendering,
 * not server actions (which are independently reachable POST endpoints).
 *
 * Fail-closed: no Supabase, no user, no ADMIN_HANDLES, or a handle not on the
 * list -> false.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const sb = await getSupabaseServer();
  if (!sb) return false;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;

  const adminHandles = (process.env.ADMIN_HANDLES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminHandles.length === 0) return false;

  const { data: profile } = await sb
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();

  return Boolean(profile) && adminHandles.includes(profile!.handle.toLowerCase());
}
