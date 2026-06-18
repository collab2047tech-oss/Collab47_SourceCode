import { getSupabaseServer } from "@/lib/supabase/server";
import type { Message } from "@/lib/supabase/types";

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

// Mock fallback data
const MOCK_CONVERSATIONS: ConversationPreview[] = [
  {
    id: "mock-conv-1",
    otherUser: { id: "u1", handle: "riya", name: "Riya Sharma", avatar_url: null, college: "Thapar TIET" },
    lastMessage: "yo are you free for the hackathon?",
    lastMessageAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    unreadCount: 1,
    isRequest: false,
  },
  {
    id: "mock-conv-2",
    otherUser: { id: "u2", handle: "arjun", name: "Arjun Mehta", avatar_url: null, college: "Punjabi University" },
    lastMessage: "sent you the brief on Telegram",
    lastMessageAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
    isRequest: false,
  },
  {
    id: "mock-conv-3",
    otherUser: { id: "u3", handle: "vikram", name: "Vikram Singh", avatar_url: null, college: "DAV Amritsar" },
    lastMessage: "thanks for the intro!",
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
    isRequest: true,
  },
];

export async function getMyConversations(
  bucket: "main" | "requests"
): Promise<ConversationPreview[]> {
  const sb = await getSupabaseServer();
  if (!sb) {
    return MOCK_CONVERSATIONS.filter((c) =>
      bucket === "main" ? !c.isRequest : c.isRequest
    );
  }

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
      `id, last_message_at,
       conversation_members!inner(user_id, last_read_at,
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

    const otherMember = members.find((m) => m.user_id !== user.id);
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

  // Create new conversation
  const { data: newConv, error: convErr } = await sb
    .from("conversations")
    .insert({ type: "one_to_one" })
    .select("id")
    .single();

  if (convErr || !newConv) {
    return { ok: false, error: convErr?.message ?? "Failed to create conversation" };
  }

  // Add both members
  const { error: membersErr } = await sb.from("conversation_members").insert([
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

  // 2. Connections check (canonical: user_a_id < user_b_id)
  const canonA = senderId < recipientId ? senderId : recipientId;
  const canonB = senderId < recipientId ? recipientId : senderId;

  const { data: connRow } = await sb
    .from("connections")
    .select("status")
    .eq("user_a_id", canonA)
    .eq("user_b_id", canonB)
    .maybeSingle();

  if (connRow?.status === "accepted") {
    return { is_request: false };
  }

  // 3. Mutual follow check
  const { data: followA } = await sb
    .from("follows")
    .select("follower_id")
    .eq("follower_id", senderId)
    .eq("following_id", recipientId)
    .maybeSingle();

  const { data: followB } = await sb
    .from("follows")
    .select("follower_id")
    .eq("follower_id", recipientId)
    .eq("following_id", senderId)
    .maybeSingle();

  if (followA && followB) {
    return { is_request: false };
  }

  // 4. Recipient dm_permission check
  const { data: recipientProfile } = await sb
    .from("profiles")
    .select("dm_permission")
    .eq("id", recipientId)
    .maybeSingle();

  const dmPerm = recipientProfile?.dm_permission ?? "everyone";

  if (dmPerm === "nobody") {
    return { blocked: true, reason: "This person is not accepting messages." };
  }

  if (dmPerm === "connections") {
    return { blocked: true, reason: "This person only accepts messages from connections." };
  }

  // 5. Project author exception: sender owns a project and recipient applied to it
  const { data: projectOwned } = await sb
    .from("projects")
    .select("id")
    .eq("author_id", senderId)
    .limit(1);

  if (projectOwned && projectOwned.length > 0) {
    const projectIds = projectOwned.map((p: { id: string }) => p.id);
    const { data: application } = await sb
      .from("project_applications")
      .select("id")
      .eq("applicant_id", recipientId)
      .in("project_id", projectIds)
      .maybeSingle();

    if (application) {
      return { is_request: false, project_override: true };
    }
  }

  // Stranger with dm_permission = 'everyone': goes to requests
  return { is_request: true };
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

  // Flip all is_request=true messages in this conversation to false
  const { error } = await sb
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
