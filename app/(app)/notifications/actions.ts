"use server";

import { revalidatePath } from "next/cache";
import { markAllNotificationsRead } from "@/lib/db/notifications";

export async function markAllReadAction() {
  await markAllNotificationsRead();
  // Refresh the notifications list and the unread bell badge (rendered in the
  // app shell layout) so it drops to 0.
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
