import { AppShell } from "@/components/layout/AppShell";
import { getMyProfile } from "@/lib/db/profiles";
import { getUnreadCount } from "@/lib/db/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, unreadCount] = await Promise.all([getMyProfile(), getUnreadCount()]);
  const me = profile
    ? { name: profile.name, handle: profile.handle, avatar_url: profile.avatar_url ?? null }
    : null;
  return (
    <AppShell me={me} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
