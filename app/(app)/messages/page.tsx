import { Avatar } from "@/components/primitives/Avatar";
import { Reveal } from "@/components/motion/Reveal";
import { getMyConversations } from "@/lib/db/messages";
import { mockMessages } from "@/lib/mockData";
import { MessagesShell } from "@/components/composite/MessagesShell";
import { Search } from "lucide-react";
import Link from "next/link";

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

  const hasSupa = mainConvs.length > 0 || requestConvs.length > 0;

  // Fall back to mock when Supabase is not returning real data
  const inboxItems = hasSupa
    ? mainConvs.map((c) => ({
        id: c.id,
        name: c.otherUser.name,
        handle: c.otherUser.handle,
        avatarUrl: c.otherUser.avatar_url ?? undefined,
        last: c.lastMessage,
        time: relativeTime(c.lastMessageAt),
        unread: c.unreadCount > 0,
        href: `/messages/${c.id}`,
      }))
    : mockMessages.map((m) => ({
        id: m.id,
        name: m.name,
        handle: "",
        avatarUrl: undefined,
        last: m.last,
        time: m.time,
        unread: m.unread,
        href: `/messages/${m.id}`,
      }));

  const requestItems = hasSupa
    ? requestConvs.map((c) => ({
        id: c.id,
        name: c.otherUser.name,
        handle: c.otherUser.handle,
        avatarUrl: c.otherUser.avatar_url ?? undefined,
        last: c.lastMessage,
        time: relativeTime(c.lastMessageAt),
        unread: c.unreadCount > 0,
        href: `/messages/requests`,
      }))
    : [];

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
