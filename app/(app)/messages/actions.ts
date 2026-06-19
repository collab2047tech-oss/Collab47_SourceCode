"use server";

import { revalidatePath } from "next/cache";
import {
  sendMessage,
  getOrCreate1to1Conversation,
  acceptMessageRequest,
  markRead,
  blockUser,
  unblockUser,
  muteConversation,
} from "@/lib/db/messages";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { DMPermission } from "@/lib/supabase/types";

export async function sendMessageAction(formData: FormData) {
  const conversationId = formData.get("conversationId") as string;
  const body = formData.get("body") as string;
  // Image is uploaded client-side directly to Storage; we only receive the URL
  // (so files never hit the Server Action's 1MB body limit).
  const imageUrl = (formData.get("image_url") as string | null)?.trim() || undefined;

  if (!conversationId || (!body?.trim() && !imageUrl)) {
    return { ok: false, error: "Missing fields" };
  }

  const result = await sendMessage({ conversationId, body: (body ?? "").trim(), imageUrl });
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return result;
}

export async function startConversationAction(
  otherUserId: string
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const result = await getOrCreate1to1Conversation(otherUserId);
  if (result.ok && result.conversationId) {
    revalidatePath("/messages");
  }
  return result;
}

export async function acceptRequestAction(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await acceptMessageRequest(conversationId);
  revalidatePath("/messages/requests");
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return result;
}

export async function markReadAction(
  conversationId: string
): Promise<{ ok: boolean }> {
  return markRead(conversationId);
}

export async function muteConversationAction(
  conversationId: string,
  muted: boolean
): Promise<{ ok: boolean; error?: string }> {
  const result = await muteConversation(conversationId, muted);
  if (result.ok) revalidatePath(`/messages/${conversationId}`);
  return result;
}

export async function blockUserAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await blockUser(userId);
  revalidatePath("/messages");
  return result;
}

export async function unblockUserAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await unblockUser(userId);
  revalidatePath("/messages");
  return result;
}

export async function updateDmPermissionAction(
  value: DMPermission
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await sb
    .from("profiles")
    .update({ dm_permission: value })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
