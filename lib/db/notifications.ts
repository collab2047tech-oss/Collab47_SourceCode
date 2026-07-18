import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

// Kinds worth a phone/browser push. Noisy/low-value kinds (like, repost, system)
// stay in-app only. The user's push subscription itself is the opt-in.
const PUSH_KINDS = new Set([
  "dm",
  "dm_request",
  "comment",
  "mention",
  "follow",
  "project_invite",
  "project_accepted",
]);

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

    // Coalesce: if an identical notification (same recipient, kind, and actor)
    // was already created in the last 10 minutes, bump its timestamp instead of
    // inserting a fresh row. Prevents react/unreact and follow/unfollow loops
    // from flooding the victim's feed. The actor is stored in payload.who.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", input.userId)
      .eq("kind", input.kind)
      .eq("payload->>who", input.actorName)
      .gt("created_at", tenMinutesAgo)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      // Already notified recently - bump to the top instead of duplicating.
      await admin
        .from("notifications")
        .update({ created_at: new Date().toISOString() })
        .eq("id", existing.id);
      return;
    }

    await admin.from("notifications").insert({
      user_id: input.userId,
      kind: input.kind,
      payload: {
        text: input.text,
        who: input.actorName,
        href: input.href,
      },
    });

    // Fresh notification (not a coalesce bump) -> also push to the recipient's
    // subscribed browsers for the kinds worth interrupting them. No-ops if they
    // never enabled push. Fire-and-forget.
    if (PUSH_KINDS.has(input.kind)) {
      void sendPushToUser(input.userId, {
        title: input.actorName,
        body: input.text,
        url: input.href,
        tag: `${input.kind}:${input.actorName}`,
      });
    }
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
