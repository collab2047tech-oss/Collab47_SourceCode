import { AppShell } from "@/components/layout/AppShell";
import { PublicTopNav } from "@/components/layout/PublicTopNav";
import {
  MessagesProvider,
  type RailConversation,
} from "@/components/messages/MessagesProvider";
import { getMyProfile } from "@/lib/db/profiles";
import { getUnreadCount } from "@/lib/db/notifications";
import {
  getMessageUnreadCount,
  getMyConversations,
  type ConversationPreview,
} from "@/lib/db/messages";

/** Same rail mapping the gated (app) layout uses, so the signed-in shell here is identical. */
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
 * Layout for PUBLIC content routes (/news, /news/[id], /t/[tag]) that must be
 * readable by logged-out visitors and crawlable by search engines, yet keep the
 * full app experience for signed-in members.
 *
 * Dual shell, no auth gate:
 *  - Signed-in member -> the exact same AppShell + MessagesProvider as the gated
 *    (app) group, so members see no difference from before.
 *  - Anonymous visitor (or not-yet-onboarded / closed account) -> the public top
 *    nav, so the page renders and indexes. Actions inside still require login.
 *
 * The gated (app) layout is intentionally left untouched.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const profile = await getMyProfile();

  // Logged-out, not-yet-onboarded, or closed account -> public shell (indexable).
  // data-news-shell="public" publishes the fixed-inset contract (globals.css)
  // the InShortsFeed reads, so the full-screen reader fits this shell exactly
  // (no sidebar/bottom-nav gutter) instead of assuming the member AppShell.
  if (!profile || profile.deleted_at || profile.suspended_at) {
    return (
      <>
        <PublicTopNav />
        <main data-news-shell="public" className="mx-auto w-full max-w-2xl px-4 pt-6">
          {children}
        </main>
      </>
    );
  }

  // Signed-in member -> full app shell, identical to the gated experience.
  const [unreadCount, messagesUnread, allConvs] = await Promise.all([
    getUnreadCount(),
    getMessageUnreadCount(),
    getMyConversations("all"),
  ]);

  const me = {
    id: profile.id,
    name: profile.name,
    handle: profile.handle,
    avatar_url: profile.avatar_url ?? null,
  };
  const mainConvs = allConvs.filter((c) => !c.isRequest);
  const requestConvs = allConvs.filter((c) => c.isRequest);

  return (
    <MessagesProvider
      initialConversations={mainConvs.map(toRail)}
      initialRequests={requestConvs.map(toRail)}
      currentUserId={profile.id}
    >
      <AppShell me={me} unreadCount={unreadCount} messagesUnread={messagesUnread}>
        {/* display:contents wrapper: adds no box (AppShell's <main> layout is
            untouched) but publishes the member fixed-inset contract to the
            InShortsFeed descendant via inherited CSS custom properties. */}
        <div data-news-shell="member" className="contents">
          {children}
        </div>
      </AppShell>
    </MessagesProvider>
  );
}
