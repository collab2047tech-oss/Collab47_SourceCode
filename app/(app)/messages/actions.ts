"use server";

import { revalidatePath } from "next/cache";
import {
  sendMessage,
  getOrCreate1to1Conversation,
  createGroupConversation,
  acceptMessageRequest,
  declineMessageRequest,
  markRead,
  blockUser,
  unblockUser,
  muteConversation,
  getConversationMessages,
  type MessageWithSender,
} from "@/lib/db/messages";
import { getMyConnections, type MiniProfile } from "@/lib/db/social";
import { getSupabaseServer } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type { DMPermission } from "@/lib/supabase/types";

export async function sendMessageAction(formData: FormData) {
  const conversationId = formData.get("conversationId") as string;
  const body = formData.get("body") as string;
  const clientId = (formData.get("client_id") as string | null)?.trim() || undefined;
  // Image is uploaded client-side directly to Storage; we only receive the URL
  // (so files never hit the Server Action's 1MB body limit).
  let imageUrl = (formData.get("image_url") as string | null)?.trim() || undefined;

  // Only accept media URLs that point at OUR Supabase Storage public path -
  // never persist an arbitrary attacker-supplied URL onto a message row.
  if (imageUrl && !imageUrl.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`)) {
    imageUrl = undefined;
  }

  if (!conversationId || (!body?.trim() && !imageUrl)) {
    return { ok: false, error: "Missing fields" };
  }

  // No revalidatePath here: display is fully optimistic (the temp bubble shows
  // instantly) and reconciled by the realtime INSERT echo + the MessagesProvider
  // rail update, so a heavy server re-render of the whole thread/inbox on every
  // send would only fight the realtime channel and re-introduce the ~1s lag.
  return sendMessage({
    conversationId,
    body: (body ?? "").trim(),
    imageUrl,
    clientId,
  });
}

/**
 * Load the page of OLDER messages immediately preceding `beforeIso` for the
 * "Load earlier" affordance. Keyset pagination on created_at; returns ascending.
 */
export async function loadEarlierAction(
  conversationId: string,
  beforeIso: string
): Promise<MessageWithSender[]> {
  if (!conversationId || !beforeIso) return [];
  return getConversationMessages(conversationId, { before: beforeIso, limit: 50 });
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

export async function getGroupCandidatesAction(): Promise<MiniProfile[]> {
  // The pool of people a user can add to a group = their accepted connections.
  return getMyConnections("all");
}

export async function createGroupAction(
  title: string,
  memberIds: string[]
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const result = await createGroupConversation(title, memberIds);
  if (result.ok) revalidatePath("/messages");
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

export async function declineRequestAction(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await declineMessageRequest(conversationId);
  revalidatePath("/messages/requests");
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
