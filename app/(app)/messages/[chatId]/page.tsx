import {
  getConversationHeader,
  getConversationMessages,
  getMyConversations,
} from "@/lib/db/messages";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Avatar } from "@/components/primitives/Avatar";
import { MessagesShell } from "@/components/composite/MessagesShell";
import { MessageThread } from "@/components/composite/MessageThread";
import { MessageComposer } from "@/components/composite/MessageComposer";
import { ChatMenu } from "@/components/composite/ChatMenu";

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

interface PageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { chatId } = await params;

  const sb = await getSupabaseServer();
  const currentUserId = sb
    ? (await sb.auth.getUser()).data.user?.id ?? null
    : null;

  const [messages, mainConvs, requestConvs, header] = await Promise.all([
    getConversationMessages(chatId),
    getMyConversations("main"),
    getMyConversations("requests"),
    getConversationHeader(chatId),
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

  // Resolve the other participant from the conversation header, which works
  // even for a freshly created thread with zero messages. Fall back to the
  // inbox/request previews if present.
  const activeConv =
    mainConvs.find((c) => c.id === chatId) ||
    requestConvs.find((c) => c.id === chatId);

  const otherUser = header.otherUser ?? activeConv?.otherUser ?? null;

  // The user can always compose in a conversation they belong to. The only
  // hard stop is being blocked (block list or the applicant->author gate) —
  // a request thread the user themselves initiated stays composable for them.
  const canCompose = !header.blocked;

  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem)] grid-cols-[340px_1fr] md:-mx-8">
      {/* Left rail (conversation list) */}
      <aside className="flex flex-col border-r border-bone bg-paper">
        <div className="p-5">
          <h2 className="font-serif text-2xl text-ink">Messages</h2>
          <div className="mt-4 flex gap-1 rounded-lg bg-cream p-1">
            <a
              href="/messages"
              className="flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium text-ash transition-colors hover:text-ink"
            >
              Inbox
            </a>
            <a
              href="/messages/requests"
              className="relative flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium text-ash transition-colors hover:text-ink"
            >
              Requests
              {requestItems.length > 0 && (
                <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-saffron text-[10px] font-semibold text-cream">
                  {requestItems.length > 9 ? "9+" : requestItems.length}
                </span>
              )}
            </a>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {inboxItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-bone/40 ${
                item.id === chatId ? "bg-bone/60" : ""
              }`}
            >
              <Avatar name={item.name} src={item.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                  <p className="shrink-0 text-xs text-ash">{item.time}</p>
                </div>
                <p className="mt-0.5 truncate text-sm text-ash">{item.last}</p>
              </div>
              {item.unread && (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-saffron" />
              )}
            </a>
          ))}
        </div>
      </aside>

      {/* Right pane */}
      <section className="flex flex-col bg-cream">
        <header className="flex items-center justify-between border-b border-bone bg-paper px-6 py-4">
          {otherUser ? (
            <div className="flex items-center gap-3">
              <Avatar
                name={otherUser.name}
                src={otherUser.avatar_url ?? undefined}
                size="md"
              />
              <div>
                <p className="text-sm font-semibold text-ink">{otherUser.name}</p>
                {otherUser.college && (
                  <p className="text-xs text-ash">{otherUser.college}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-9" />
          )}
          <ChatMenu
            conversationId={chatId}
            otherUserId={(otherUser as { id?: string } | null)?.id ?? null}
          />
        </header>

        <MessageThread
          conversationId={chatId}
          initialMessages={messages}
          currentUserId={currentUserId ?? ""}
        />

        <MessageComposer
          conversationId={chatId}
          canCompose={canCompose}
          cannotComposeReason={header.blockedReason}
        />
      </section>
    </div>
  );
}
