"use server";

import { revalidatePath } from "next/cache";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/db/notifications";

export async function markAllReadAction() {
  await markAllNotificationsRead();
  // Refresh the notifications list and the unread bell badge (rendered in the
  // app shell layout) so it drops to 0.
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Mark a single notification read (used when the row is clicked). Refreshes the
 * notifications list and the bell badge so both stay accurate.
 */
export async function markNotificationReadAction(id: string) {
  await markNotificationRead(id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
