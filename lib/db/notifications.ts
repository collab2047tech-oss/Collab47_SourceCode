import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Unread notification count for the current user (read_at is null). */
export async function getUnreadCount(): Promise<number> {
  try {
    const sb = await getSupabaseServer();
    if (!sb) return 0;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return 0;
    const { count } = await sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Mark all of the current user's notifications as read. */
export async function markAllNotificationsRead(): Promise<void> {
  try {
    const sb = await getSupabaseServer();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  } catch {
    // best-effort
  }
}

/**
 * Mark a single notification as read for the current user. Used when a row is
 * clicked so the bell badge and per-row dot stay accurate. Best-effort; never
 * throws. RLS (notif_update_own) already scopes updates to the owner, and we
 * also constrain on user_id defensively.
 */
export async function markNotificationRead(id: string): Promise<void> {
  try {
    const sb = await getSupabaseServer();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("read_at", null);
  } catch {
    // best-effort
  }
}

/**
 * Insert a notification row. Fire-and-forget - never throws.
 * Uses the admin client because the notifications table is insert-restricted by RLS.
 */
export async function createNotification(input: {
  userId: string;
  kind: string;
  actorName: string;
  text: string;
  href: string;
}): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    await admin.from("notifications").insert({
      user_id: input.userId,
      kind: input.kind,
      payload: {
        text: input.text,
        who: input.actorName,
        href: input.href,
      },
    });
  } catch {
    // Best-effort: a failed notification must never surface to the caller.
  }
}

/**
 * Fetch a user's display name and handle by their profile id.
 * Returns null if the profile cannot be found or the DB is unavailable.
 */
export async function getActorDisplayInfo(
  actorId: string
): Promise<{ name: string; handle: string } | null> {
  try {
    const admin = getAdminClient();
    if (!admin) return null;
    const { data } = await admin
      .from("profiles")
      .select("name, handle")
      .eq("id", actorId)
      .maybeSingle();
    if (!data) return null;
    return { name: data.name as string, handle: data.handle as string };
  } catch {
    return null;
  }
}
