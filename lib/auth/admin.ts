import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Server-side admin check. The ONLY source of truth for moderation privilege.
 * Must be called inside every moderation server action / db function BEFORE any
 * service-role operation - the admin route layout only guards page rendering,
 * not server actions (which are independently reachable POST endpoints).
 *
 * Admin is keyed on the STABLE auth user id (ADMIN_USER_IDS, comma-separated
 * UUIDs), not the handle - a handle is user-mutable and could be reassigned, so
 * keying on it is a privilege-escalation footgun.
 *
 * Fail-closed: no Supabase, no user, or an id not on the list -> false. If
 * ADMIN_USER_IDS is unset we fall back to the legacy ADMIN_HANDLES check so a
 * misconfigured deploy degrades to the old behaviour rather than locking out all
 * admins; prefer ADMIN_USER_IDS.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const sb = await getSupabaseServer();
  if (!sb) return false;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;

  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminIds.length > 0) {
    return adminIds.includes(user.id.toLowerCase());
  }

  // Fallback (legacy): handle-based check when ADMIN_USER_IDS is not configured.
  // Handle is user-mutable - prefer ADMIN_USER_IDS in any real deployment.
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
