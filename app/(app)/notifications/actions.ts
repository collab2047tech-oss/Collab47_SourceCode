"use server";

import { revalidatePath } from "next/cache";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/db/notifications";

export async function markAllReadAction() {
  await markAllNotificationsRead();
  // The notifications list flips its rows optimistically, so we do NOT
  // revalidate "/notifications" (that would refetch and clobber the optimistic
  // state). We only reconcile the unread bell badge in the app-shell layout so
  // it drops to 0 on the next navigation; the badge sync is invisible.
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Mark a single notification read (used when the row is clicked). The list
 * clears the row optimistically; here we only reconcile the bell badge in the
 * background so it stays accurate without refetching the list.
 */
export async function markNotificationReadAction(id: string) {
  await markNotificationRead(id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
