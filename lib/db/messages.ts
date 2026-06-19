import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Message } from "@/lib/supabase/types";
import { createNotification, getActorDisplayInfo } from "@/lib/db/notifications";
import { moderateContent } from "@/lib/moderation/moderate";

export interface MiniProfile {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
}

export interface ConversationPreview {
  id: string;
  otherUser: MiniProfile;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isRequest: boolean;
}

export interface MessageWithSender extends Message {
  sender: MiniProfile;
}

export interface PermissionResult {
  blocked?: boolean;
  reason?: string;
  is_request?: boolean;
  project_override?: boolean;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  isRequest?: boolean;
  blockedReason?: string;
  error?: string;
}

export async function getMyConversations(
  bucket: "main" | "requests"
): Promise<ConversationPreview[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];

  // Get all conversations the current user is a member of
  const { data: memberRows } = await sb
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id);

  if (!memberRows || memberRows.length === 0) return [];

  const convIds = memberRows.map((r) => r.conversation_id);

  // Fetch conversations with their latest message and the other member's profile
  const { data: conversations } = await sb
    .from("conversations")
    .select(
      `id, type, last_message_at,
       conversation_members(user_id, last_read_at,
         profiles:profiles!conversation_members_user_id_fkey(id, handle, name, avatar_url, college)
       ),
       messages(id, body, is_request, created_at, sender_id)`
    )
    .in("id", convIds)
    .order("last_message_at", { ascending: false });

  if (!conversations) return [];

  const results: ConversationPreview[] = [];

  for (const conv of conversations as Record<string, unknown>[]) {
    const members = conv.conversation_members as Array<{
      user_id: string;
      last_read_at: string | null;
      profiles: MiniProfile;
    }>;
    const msgs = conv.messages as Array<{
      id: string;
      body: string;
      is_request: boolean;
      created_at: string;
      sender_id: string;
    }>;
    const isGroup = conv.type === "group";

    // For a group, the "other user" slot represents the whole team.
    const otherMember = isGroup
      ? {
          user_id: conv.id as string,
          last_read_at: null,
          profiles: {
            id: conv.id as string,
            handle: "",
            name: `Team chat (${members.length})`,
            avatar_url: members.find((m) => m.user_id !== user.id)?.profiles?.avatar_url ?? null,
            college: null,
          } as MiniProfile,
        }
      : members.find((m) => m.user_id !== user.id);
    if (!otherMember) continue;

    const myMember = members.find((m) => m.user_id === user.id);
    const sortedMsgs = [...(msgs || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestMsg = sortedMsgs[0];
    if (!latestMsg) continue;

    const isRequest = latestMsg.is_request;
    if (bucket === "main" && isRequest) continue;
    if (bucket === "requests" && !isRequest) continue;

    const lastReadAt = myMember?.last_read_at
      ? new Date(myMember.last_read_at).getTime()
      : 0;
    const unreadCount = (msgs || []).filter(
      (m) =>
        m.sender_id !== user.id &&
        new Date(m.created_at).getTime() > lastReadAt
    ).length;

    results.push({
      id: conv.id as string,
      otherUser: otherMember.profiles,
      lastMessage: latestMsg.body,
      lastMessageAt: conv.last_message_at as string,
      unreadCount,
      isRequest,
    });
  }

  return results;
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50
): Promise<MessageWithSender[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data } = await sb
    .from("messages")
    .select(
      "*, sender:profiles!messages_sender_id_fkey(id, handle, name, avatar_url, college)"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  // Return in ascending order for display
  return (data as MessageWithSender[]).reverse();
}

export async function getOrCreate1to1Conversation(
  otherUserId: string
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Look for existing 1:1 conversation between the two users
  const { data: myMemberships } = await sb
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (myMemberships && myMemberships.length > 0) {
    const myConvIds = myMemberships.map((m) => m.conversation_id);

    const { data: otherMemberships } = await sb
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myConvIds);

    if (otherMemberships && otherMemberships.length > 0) {
      // Verify it's a one_to_one conversation
      const sharedConvId = otherMemberships[0].conversation_id;
      const { data: conv } = await sb
        .from("conversations")
        .select("id, type")
        .eq("id", sharedConvId)
        .eq("type", "one_to_one")
        .maybeSingle();

      if (conv) {
        return { ok: true, conversationId: conv.id };
      }
    }
  }

  // Create the conversation + both memberships via the service-role client.
  // Membership management is privileged (RLS forbids users adding others), so
  // it must happen server-side after we've verified the caller above.
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured" };

  const { data: newConv, error: convErr } = await admin
    .from("conversations")
    .insert({ type: "one_to_one" })
    .select("id")
    .single();

  if (convErr || !newConv) {
    return { ok: false, error: convErr?.message ?? "Failed to create conversation" };
  }

  const { error: membersErr } = await admin.from("conversation_members").insert([
    { conversation_id: newConv.id, user_id: user.id },
    { conversation_id: newConv.id, user_id: otherUserId },
  ]);

  if (membersErr) {
    return { ok: false, error: membersErr.message };
  }

  return { ok: true, conversationId: newConv.id };
}

export async function computeIsRequest(
  senderId: string,
  recipientId: string
): Promise<PermissionResult> {
  const sb = await getSupabaseServer();
  if (!sb) return { is_request: false };

  // 1. Block check: has recipient blocked sender, or sender blocked recipient
  const { data: blockRows } = await sb
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId}),and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId})`
    );

  if (blockRows && blockRows.length > 0) {
    return { blocked: true, reason: "You cannot message this person." };
  }

  // 2. Project relationships (highest-priority gates).
  const [{ data: senderProjects }, { data: recipientProjects }] = await Promise.all([
    sb.from("projects").select("id").eq("author_id", senderId),
    sb.from("projects").select("id").eq("author_id", recipientId),
  ]);

  //   a) Sender has applied to a project the RECIPIENT authors -> BLOCKED.
  //      Applicants cannot initiate to the author; the author reaches out first.
  if (recipientProjects && recipientProjects.length > 0) {
    const ids = recipientProjects.map((p: { id: string }) => p.id);
    const { data: app } = await sb
      .from("project_applications")
      .select("id")
      .eq("applicant_id", senderId)
      .in("project_id", ids)
      .maybeSingle();
    if (app) return { blocked: true, reason: "Applicants cannot message project authors first." };
  }

  //   b) Sender authors a project the RECIPIENT applied to -> direct, main inbox.
  if (senderProjects && senderProjects.length > 0) {
    const ids = senderProjects.map((p: { id: string }) => p.id);
    const { data: app } = await sb
      .from("project_applications")
      .select("id")
      .eq("applicant_id", recipientId)
      .in("project_id", ids)
      .maybeSingle();
    if (app) return { is_request: false, project_override: true };
  }

  //   c) Shared team membership (same project) -> direct, main inbox.
  const [{ data: myTeams }, { data: theirTeams }] = await Promise.all([
    sb.from("project_members").select("project_id").eq("user_id", senderId),
    sb.from("project_members").select("project_id").eq("user_id", recipientId),
  ]);
  const mine = new Set((myTeams ?? []).map((m) => m.project_id as string));
  if ((theirTeams ?? []).some((m) => mine.has(m.project_id as string))) {
    return { is_request: false };
  }

  // 3. Recipient DM permission setting.
  const { data: recipientProfile } = await sb
    .from("profiles")
    .select("dm_permission")
    .eq("id", recipientId)
    .maybeSingle();
  const dmPerm = recipientProfile?.dm_permission ?? "everyone";

  // 'nobody' allows only existing threads + project authors (handled above) -> block new.
  if (dmPerm === "nobody") {
    return { blocked: true, reason: "This person is not accepting new messages." };
  }

  // 4. Degree of separation on the follow + accepted-connection graph (<=3).
  //    1st / 2nd / 3rd degree land directly in the main inbox (LinkedIn-style).
  if (await isWithinDegree(sb, senderId, recipientId, 3)) {
    return { is_request: false };
  }

  // 5. True stranger (no path within 3 degrees).
  if (dmPerm === "connections") {
    return { blocked: true, reason: "This person only accepts messages from their network." };
  }
  // 'everyone': stranger lands in the Requests folder.
  return { is_request: true };
}

/**
 * BFS over the undirected social graph (follows in either direction + accepted
 * connections) to test whether `target` is within `maxDepth` hops of `start`.
 * Classical graph traversal, batched per level, bounded to keep it fast.
 */
async function isWithinDegree(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  start: string,
  target: string,
  maxDepth = 3
): Promise<boolean> {
  if (start === target) return true;
  const visited = new Set<string>([start]);
  let frontier = [start];

  for (let depth = 0; depth < maxDepth; depth++) {
    if (frontier.length === 0) break;
    const ids = frontier.slice(0, 800); // bound per level
    const [{ data: out }, { data: inc }, { data: conns }] = await Promise.all([
      sb.from("follows").select("following_id").in("follower_id", ids),
      sb.from("follows").select("follower_id").in("following_id", ids),
      sb
        .from("connections")
        .select("user_a_id, user_b_id")
        .eq("status", "accepted")
        .or(`user_a_id.in.(${ids.join(",")}),user_b_id.in.(${ids.join(",")})`),
    ]);

    const next = new Set<string>();
    for (const r of out ?? []) next.add(r.following_id as string);
    for (const r of inc ?? []) next.add(r.follower_id as string);
    for (const c of conns ?? []) {
      next.add(c.user_a_id as string);
      next.add(c.user_b_id as string);
    }
    if (next.has(target)) return true;

    frontier = [];
    for (const n of next) {
      if (!visited.has(n)) {
        visited.add(n);
        frontier.push(n);
      }
    }
  }
  return false;
}

export async function sendMessage({
  conversationId,
  body,
  imageUrl,
}: {
  conversationId: string;
  body: string;
  imageUrl?: string;
}): Promise<SendMessageResult> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Moderate non-empty message body before DB insert
  if (body && body.length > 0) {
    const moderationResult = await moderateContent(body);
    if (!moderationResult.ok) {
      return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
    }
  }

  // Find the other member of the conversation
  const { data: members } = await sb
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", user.id);

  if (!members || members.length === 0) {
    return { ok: false, error: "Conversation not found" };
  }

  const recipientId = members[0].user_id;

  // Permission check
  const perm = await computeIsRequest(user.id, recipientId);

  if (perm.blocked) {
    return { ok: false, blockedReason: perm.reason };
  }

  const isRequest = perm.is_request ?? false;

  // Insert message
  const { data: msg, error: msgErr } = await sb
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      image_url: imageUrl ?? null,
      is_request: isRequest,
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    return { ok: false, error: msgErr?.message ?? "Failed to send message" };
  }

  // Update last_message_at on conversation
  await sb
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Fire-and-forget notification to the recipient.
  void (async () => {
    try {
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      await createNotification({
        userId: recipientId,
        kind: isRequest ? "dm_request" : "dm",
        actorName: actor.name,
        text: `${actor.name} sent you a message`,
        href: `/messages/${conversationId}`,
      });
    } catch { /* best-effort */ }
  })();

  return { ok: true, messageId: msg.id, isRequest };
}

export async function acceptMessageRequest(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Verify the caller is actually a member of this conversation.
  const { data: membership } = await sb
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Not part of this conversation" };

  // Flip request->accepted via service role (RLS limits message updates to the
  // sender; accepting a request is done by the recipient).
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured" };

  const { error } = await admin
    .from("messages")
    .update({ is_request: false })
    .eq("conversation_id", conversationId)
    .eq("is_request", true);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function markRead(
  conversationId: string
): Promise<{ ok: boolean }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false };

  const now = new Date().toISOString();

  // Update last_read_at for current user in this conversation
  await sb
    .from("conversation_members")
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  // Mark messages from others as read
  await sb
    .from("messages")
    .update({ read_at: now })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  return { ok: true };
}

export async function blockUser(
  otherUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await sb
    .from("blocks")
    .insert({ blocker_id: user.id, blocked_id: otherUserId });

  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function unblockUser(
  otherUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await sb
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", otherUserId);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** Mute / unmute a conversation for the current user (conversation_members.muted). */
export async function muteConversation(
  conversationId: string,
  muted: boolean
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const { error } = await sb
    .from("conversation_members")
    .update({ muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
