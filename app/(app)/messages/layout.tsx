import { getMyConversations, type ConversationPreview } from "@/lib/db/messages";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  MessagesProvider,
  type RailConversation,
} from "@/components/messages/MessagesProvider";

export const dynamic = "force-dynamic";

function toRail(c: ConversationPreview): RailConversation {
  return {
    id: c.id,
    name: c.otherUser.name,
    handle: c.otherUser.handle,
    avatarUrl: c.otherUser.avatar_url ?? undefined,
    last: c.lastMessage,
    lastMessageAt: c.lastMessageAt,
    unread: c.unreadCount > 0,
    isGroup: c.isGroup,
    isRequest: c.isRequest,
  };
}

/**
 * Messages layout. Fetches the inbox ONCE here and seeds MessagesProvider, so
 * the conversation rail is held in client memory and never re-derived per
 * thread open (the root cause of the ~1s inbox lag). Every messages route -
 * index, requests, and each thread - renders inside this single provider.
 */
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await getSupabaseServer();
  const currentUserId = sb
    ? (await sb.auth.getUser()).data.user?.id ?? ""
    : "";

  // Fetch the full inbox ONCE (the query is identical for both buckets; only the
  // final is_request filter differs), then partition in JS. This halves the heavy
  // conversations+messages fetch on every messages navigation.
  const allConvs = await getMyConversations("all");
  const mainConvs = allConvs.filter((c) => !c.isRequest);
  const requestConvs = allConvs.filter((c) => c.isRequest);

  return (
    <MessagesProvider
      initialConversations={mainConvs.map(toRail)}
      initialRequests={requestConvs.map(toRail)}
      currentUserId={currentUserId}
    >
      {children}
    </MessagesProvider>
  );
}
