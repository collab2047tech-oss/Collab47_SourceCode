import {
  getConversationHeader,
  getConversationMessages,
  getMyConversations,
} from "@/lib/db/messages";
import { getSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { ArrowLeft, Users } from "lucide-react";
import { MessageThread } from "@/components/composite/MessageThread";
import { MessageComposer } from "@/components/composite/MessageComposer";
import { ChatMenu } from "@/components/composite/ChatMenu";
import { AcceptRequestButton } from "@/components/composite/AcceptRequestButton";
import { DeclineRequestButton } from "@/components/composite/DeclineRequestButton";

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
    isGroup: c.isGroup,
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
    isGroup: c.isGroup,
    href: `/messages/requests`,
  }));

  // Resolve the other participant from the conversation header, which works
  // even for a freshly created thread with zero messages. Fall back to the
  // inbox/request previews if present.
  const activeConv =
    mainConvs.find((c) => c.id === chatId) ||
    requestConvs.find((c) => c.id === chatId);

  const otherUser = header.otherUser ?? activeConv?.otherUser ?? null;
  const isGroup = header.isGroup;
  const groupTitle = header.groupTitle ?? activeConv?.otherUser.name ?? "Group";

  // The user can always compose in a conversation they belong to. The only
  // hard stop is being blocked (block list or the applicant->author gate) —
  // a request thread the user themselves initiated stays composable for them.
  // Group members can always post (no block possible).
  const canCompose = isGroup || !header.blocked;

  // Tailor the "cannot compose" message: if the current user is the one who
  // blocked, tell them to unblock via the menu; otherwise show the gate reason.
  const cannotComposeReason = header.blockedByMe
    ? "You blocked this person. Unblock from the menu to message them."
    : header.blockedReason;

  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem-3.5rem)] md:h-[calc(100dvh-4rem)] grid-cols-1 overflow-hidden md:-mx-8 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
      {/* Left rail (conversation list) — hidden on mobile; the thread is the page */}
      <aside className="hidden min-w-0 flex-col border-r border-bone bg-paper md:flex">
        <div className="p-4 sm:p-5">
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
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {inboxItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={`flex w-full items-start gap-3 border-b border-bone/60 px-5 py-4 text-left transition-colors hover:bg-bone/40 ${
                item.id === chatId ? "bg-bone/60" : ""
              }`}
            >
              {item.isGroup ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-moss/15 text-moss">
                  <Users className="size-5" />
                </span>
              ) : (
                <Avatar name={item.name} src={item.avatarUrl} size="md" />
              )}
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

      {/* Right pane — full width on mobile */}
      <section className="flex min-w-0 flex-col bg-cream">
        <header className="flex items-center justify-between gap-2 border-b border-bone bg-paper px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Mobile-only back arrow to the conversation list */}
            <Link
              href="/messages"
              aria-label="Back to messages"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-ash transition-colors hover:bg-bone hover:text-ink active:scale-95 md:hidden"
            >
              <ArrowLeft className="size-5" />
            </Link>
            {isGroup ? (
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-moss/15 text-moss">
                  <Users className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{groupTitle}</p>
                  <p className="text-xs text-ash">
                    {header.memberCount ?? 0} members
                  </p>
                </div>
              </div>
            ) : otherUser ? (
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={otherUser.name}
                  src={otherUser.avatar_url ?? undefined}
                  size="md"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{otherUser.name}</p>
                  {otherUser.college && (
                    <p className="truncate text-xs text-ash">{otherUser.college}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-9" />
            )}
          </div>
          <ChatMenu
            conversationId={chatId}
            otherUserId={isGroup ? null : (otherUser as { id?: string } | null)?.id ?? null}
            initialMuted={header.muted}
            blockedByMe={header.blockedByMe}
          />
        </header>

        {/* Inbound request banner: a request you received (not one you sent).
            Lets the recipient accept (moves it to the main inbox) or decline
            (deletes the request) right from the open thread. */}
        {!isGroup && header.isRequest && !header.isRequestSender && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bone bg-saffron/5 px-3 py-3 sm:px-6">
            <p className="text-sm text-ink">
              <span className="font-semibold">{otherUser?.name ?? "This person"}</span>{" "}
              wants to message you.
            </p>
            <div className="flex gap-2">
              <AcceptRequestButton conversationId={chatId} />
              <DeclineRequestButton conversationId={chatId} redirectTo="/messages/requests" />
            </div>
          </div>
        )}

        <MessageThread
          conversationId={chatId}
          initialMessages={messages}
          currentUserId={currentUserId ?? ""}
        />

        <MessageComposer
          conversationId={chatId}
          currentUserId={currentUserId ?? ""}
          canCompose={canCompose}
          cannotComposeReason={cannotComposeReason}
        />
      </section>
    </div>
  );
}
