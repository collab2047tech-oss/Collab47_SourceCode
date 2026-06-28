import { AppShell } from "@/components/layout/AppShell";
import { FeedRealtimeProvider } from "@/components/composite/FeedRealtimeProvider";
import { getMyProfile } from "@/lib/db/profiles";
import { getUnreadCount } from "@/lib/db/notifications";
import { getMessageUnreadCount } from "@/lib/db/messages";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, unreadCount, messagesUnread] = await Promise.all([
    getMyProfile(),
    getUnreadCount(),
    getMessageUnreadCount(),
  ]);
  const me = profile
    ? { name: profile.name, handle: profile.handle, avatar_url: profile.avatar_url ?? null }
    : null;
  return (
    <AppShell me={me} unreadCount={unreadCount} messagesUnread={messagesUnread}>
      {/* One realtime channel for the whole app shell -> live post counts
          (likes/comments/reposts/saves) tick across users without a refresh. */}
      <FeedRealtimeProvider>{children}</FeedRealtimeProvider>
    </AppShell>
  );
}
