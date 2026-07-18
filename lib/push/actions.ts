"use server";

import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Store (or refresh) the current user's browser push subscription. Uses
 * delete-then-insert keyed on the globally-unique endpoint so re-subscribing the
 * same browser rotates its keys without needing an UPDATE policy.
 */
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false };
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false };
  if (!sub.endpoint || !sub.p256dh || !sub.auth) return { ok: false };

  await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", user.id);
  const { error } = await sb.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    user_agent: sub.userAgent ?? null,
  });
  return { ok: !error };
}

/** Remove one browser's subscription (on disable / unsubscribe). */
export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false };
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false };
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: true };
}
