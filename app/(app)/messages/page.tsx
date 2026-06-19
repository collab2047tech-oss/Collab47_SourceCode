import { Reveal } from "@/components/motion/Reveal";
import { getMyConversations } from "@/lib/db/messages";
import { MessagesShell } from "@/components/composite/MessagesShell";

export const dynamic = "force-dynamic";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default async function MessagesPage() {
  const [mainConvs, requestConvs] = await Promise.all([
    getMyConversations("main"),
    getMyConversations("requests"),
  ]);

  const inboxItems = mainConvs.map((c) => ({
    id: c.id,
    name: c.otherUser.name,
    handle: c.otherUser.handle,
    avatarUrl: c.otherUser.avatar_url ?? undefined,
    last: c.lastMessage,
    time: relativeTime(c.lastMessageAt),
    unread: c.unreadCount > 0,
    href: `/messages/${c.id}`,
  }));

  const requestItems = requestConvs.map((c) => ({
    id: c.id,
    name: c.otherUser.name,
    handle: c.otherUser.handle,
    avatarUrl: c.otherUser.avatar_url ?? undefined,
    last: c.lastMessage,
    time: relativeTime(c.lastMessageAt),
    unread: c.unreadCount > 0,
    href: `/messages/requests`,
  }));

  return (
    <Reveal>
      <MessagesShell
        inboxItems={inboxItems}
        requestItems={requestItems}
        requestCount={requestItems.length}
      />
    </Reveal>
  );
}
