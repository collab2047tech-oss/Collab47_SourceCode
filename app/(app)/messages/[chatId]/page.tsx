import {
  getConversationHeader,
  getConversationMessages,
  type MiniProfile,
} from "@/lib/db/messages";
import { getMyProfile } from "@/lib/db/profiles";
import { getSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { ArrowLeft, Users } from "lucide-react";
import { MessageThread } from "@/components/composite/MessageThread";
import { MessageComposer } from "@/components/composite/MessageComposer";
import { ChatMenu } from "@/components/composite/ChatMenu";
import { AcceptRequestButton } from "@/components/composite/AcceptRequestButton";
import { DeclineRequestButton } from "@/components/composite/DeclineRequestButton";
import { ConversationRail } from "@/components/messages/ConversationRail";
import { ThreadProvider } from "@/components/messages/ThreadProvider";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { chatId } = await params;

  const sb = await getSupabaseServer();
  const currentUserId = sb
    ? (await sb.auth.getUser()).data.user?.id ?? null
    : null;

  // TWO light queries instead of FOUR: the rail now reads from MessagesProvider
  // (already in client memory) instead of being re-derived server-side here.
  const [messages, header, myProfile] = await Promise.all([
    getConversationMessages(chatId),
    getConversationHeader(chatId),
    getMyProfile(),
  ]);

  const me: MiniProfile | null = myProfile
    ? {
        id: myProfile.id,
        handle: myProfile.handle,
        name: myProfile.name,
        avatar_url: myProfile.avatar_url,
        college: myProfile.college,
      }
    : null;

  const otherUser = header.otherUser ?? null;
  const isGroup = header.isGroup;
  const groupTitle = header.groupTitle ?? "Group";

  // The user can always compose in a conversation they belong to. The only hard
  // stop is being blocked (block list or the applicant->author gate).
  const canCompose = isGroup || !header.blocked;

  const cannotComposeReason = header.blockedByMe
    ? "You blocked this person. Unblock from the menu to message them."
    : header.blockedReason;

  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem-4rem)] md:h-[calc(100dvh-4rem)] grid-cols-1 overflow-hidden md:-mx-8 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
      {/* Shared rail - hidden on mobile; the thread is the page. Same component
          as the index so the two never drift, with client-transition rows. */}
      <div className="hidden md:flex md:min-h-0 md:min-w-0 md:flex-col">
        <ConversationRail activeId={chatId} />
      </div>

      {/* Right pane - full width on mobile. min-h-0 lets the thread scroll. */}
      <ThreadProvider
        conversationId={chatId}
        initialMessages={messages}
        currentUserId={currentUserId ?? ""}
        me={me}
      >
        <section className="flex min-h-0 min-w-0 flex-col bg-cream">
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
                    <p className="text-xs text-ash">{header.memberCount ?? 0} members</p>
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
              otherUserId={isGroup ? null : otherUser?.id ?? null}
              initialMuted={header.muted}
              blockedByMe={header.blockedByMe}
            />
          </header>

          {/* Inbound request banner: a request you received (not one you sent). */}
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

          <MessageThread conversationId={chatId} currentUserId={currentUserId ?? ""} />

          <MessageComposer
            conversationId={chatId}
            currentUserId={currentUserId ?? ""}
            canCompose={canCompose}
            cannotComposeReason={cannotComposeReason}
          />
        </section>
      </ThreadProvider>
    </div>
  );
}
