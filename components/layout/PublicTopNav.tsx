import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Nav } from "@/components/landing/Nav";
import { getMyProfile } from "@/lib/db/profiles";
import { getUnreadCount } from "@/lib/db/notifications";
import { Home, Compass, Users, Briefcase, MessageSquare, Newspaper, Bell } from "lucide-react";
import { PublicMobileMenu } from "./PublicTopNavMobile";

const LINKS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/network", label: "Network", icon: Users },
  { href: "/collabs", label: "Collabs", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

/**
 * Top navigation for PUBLIC pages (/u/[handle], /p/[short_id]) that are also
 * reachable while signed in. Signed-out visitors get the marketing nav (with
 * Sign up / Log in); signed-in members get real app navigation + their avatar,
 * so they never see "Sign up / Log in" while logged in.
 */
export async function PublicTopNav() {
  const profile = await getMyProfile();

  // Signed out -> marketing nav.
  if (!profile) return <Nav />;

  const unread = await getUnreadCount();
  const badge = unread > 9 ? "9+" : unread > 0 ? String(unread) : null;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-bone bg-cream/85 backdrop-blur-md">
      <div className="container-edit flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6 lg:gap-8">
          <Link
            href="/home"
            className="shrink-0 font-serif text-2xl font-normal tracking-tight text-ink transition-opacity hover:opacity-80"
          >
            Collab47.
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-1.5 text-sm text-ink/75 transition-colors hover:text-saffron"
              >
                <l.icon className="size-4" />
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative rounded-full border border-bone bg-paper p-2.5 transition-colors hover:bg-bone active:scale-95"
          >
            <Bell className="size-4 text-ink" />
            {badge ? (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-semibold text-cream">
                {badge}
              </span>
            ) : null}
          </Link>
          <Link href="/profile" aria-label="Your profile" className="shrink-0">
            <Avatar
              name={profile.name}
              src={profile.avatar_url ?? undefined}
              size="sm"
              className="ring-2 ring-bone transition-all hover:ring-saffron/40"
            />
          </Link>
          {/* Mobile menu: exposes app navigation on small screens. */}
          <PublicMobileMenu links={LINKS} />
        </div>
      </div>
    </header>
  );
}
