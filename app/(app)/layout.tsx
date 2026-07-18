import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
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
import { getSupabaseServer } from "@/lib/supabase/server";

/** Map an inbox preview to the rail's cached shape (shared with the messages layout). */
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

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, unreadCount, messagesUnread, allConvs] = await Promise.all([
    getMyProfile(),
    getUnreadCount(),
    getMessageUnreadCount(),
    getMyConversations("all"),
  ]);

  // ACCOUNT-STATUS GATE. A missing profile means the user has not onboarded;
  // a set deleted_at / suspended_at means the account is closed or banned. In
  // every case the app UI must not render. (RLS + middleware are the deeper
  // defenses; this blocks the authenticated-but-barred user from the shell.)
  if (!profile) {
    // Mirror the existing onboarding handling used across /profile, /settings.
    redirect("/onboarding");
  }
  if (profile.deleted_at || profile.suspended_at) {
    const sb = await getSupabaseServer();
    if (sb) await sb.auth.signOut();
    redirect("/login");
  }

  const me = { id: profile.id, name: profile.name, handle: profile.handle, avatar_url: profile.avatar_url ?? null };

  // Seed the app-wide DM inbox here (full membership list, not just a count) so
  // MessagesProvider can keep unreadCount live everywhere via one realtime
  // channel - the messages route renders inside this same provider, so the DM
  // badge ticks on every page, not only inside /messages.
  const mainConvs = allConvs.filter((c) => !c.isRequest);
  const requestConvs = allConvs.filter((c) => c.isRequest);

  return (
    <MessagesProvider
      initialConversations={mainConvs.map(toRail)}
      initialRequests={requestConvs.map(toRail)}
      currentUserId={profile.id}
    >
      <AppShell me={me} unreadCount={unreadCount} messagesUnread={messagesUnread}>
        {/* Live post counts are handled by the global subscribePostCounts()
            manager (lib/realtime/postCounts) - no provider needed, works on every
            page including /p and /u. */}
        {children}
      </AppShell>
    </MessagesProvider>
  );
}
