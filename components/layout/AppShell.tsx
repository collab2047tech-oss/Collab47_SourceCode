"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/primitives/Avatar";
import {
  Home,
  Compass,
  Users,
  MessageSquare,
  User,
  Settings,
  Plus,
  Bell,
  Search,
  Briefcase,
  Newspaper,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/network", label: "Network", icon: Users },
  { href: "/collabs", label: "Collabs", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/notifications", label: "Inbox", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

// The five primary destinations shown in the mobile bottom bar.
const BOTTOM_NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/network", label: "Network", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

// Destinations not in the bottom bar, surfaced via the "More" sheet on mobile.
const MORE_NAV = nav.filter(
  (n) => !BOTTOM_NAV.some((b) => b.href === n.href)
);

export function AppShell({
  children,
  me,
  unreadCount = 0,
}: {
  children: React.ReactNode;
  me: { name: string; handle: string; avatar_url: string | null } | null;
  unreadCount?: number;
}) {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const displayName = me?.name ?? "You";
  const displayHandle = me?.handle ?? "";
  const badge = unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;

  const isActive = (href: string) => path === href || path?.startsWith(href + "/");

  // Close the "More" sheet on navigation.
  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  // Lock scroll while the mobile "More" sheet is open.
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  return (
    <div className="min-h-dvh bg-cream">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-bone bg-cream px-6 py-8 md:flex">
        <div>
          <Link
            href="/home"
            className="font-serif text-2xl font-normal text-ink transition-opacity hover:opacity-80"
          >
            Collab47.
          </Link>

          <Link
            href="/profile"
            className="mt-12 flex items-center gap-3 rounded-lg border border-bone bg-paper p-3 transition-all hover:-translate-y-0.5 hover:border-saffron/40"
          >
            <Avatar name={displayName} src={me?.avatar_url ?? undefined} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{displayName}</p>
              {displayHandle ? (
                <p className="truncate text-xs text-ash">@{displayHandle}</p>
              ) : null}
            </div>
          </Link>

          <nav className="mt-8 flex flex-col gap-1">
            {nav.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active ? "bg-ink text-cream" : "text-ink/80 hover:bg-bone"
                  )}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <Link
          href="/home#composer"
          className="flex items-center justify-center gap-2 rounded-full bg-saffron px-4 py-3 text-sm font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-[0.98]"
        >
          <Plus className="size-4" /> New post
        </Link>
      </aside>

      {/* Top bar (mobile + desktop) */}
      <header className="sticky top-0 z-40 border-b border-bone bg-cream/85 backdrop-blur-md md:ml-60">
        <div className="flex h-16 items-center gap-3 px-4 md:px-8">
          {/* Mobile-only brand keeps orientation when sidebar is hidden */}
          <Link
            href="/home"
            className="shrink-0 font-serif text-xl font-normal text-ink md:hidden"
          >
            C47.
          </Link>
          <form
            action="/explore"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-bone bg-paper px-4 py-2 transition-colors focus-within:border-saffron/40 md:max-w-md"
          >
            <button type="submit" aria-label="Search" className="shrink-0 text-ash hover:text-ink">
              <Search className="size-4" />
            </button>
            <input
              name="q"
              placeholder="Search people, posts, projects"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ash"
            />
          </form>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative shrink-0 rounded-full border border-bone bg-paper p-2.5 transition-colors hover:bg-bone active:scale-95"
          >
            <Bell className="size-4 text-ink" />
            {badge ? (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-semibold text-cream">
                {badge}
              </span>
            ) : null}
          </Link>
          {/* Mobile profile shortcut (sidebar is hidden below md) */}
          <Link href="/profile" aria-label="Your profile" className="shrink-0 md:hidden">
            <Avatar
              name={displayName}
              src={me?.avatar_url ?? undefined}
              size="sm"
              className="ring-2 ring-bone transition-all hover:ring-saffron/40"
            />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 pb-24 pt-6 md:ml-60 md:px-8 md:pb-8">
        {children}
      </main>

      {/* Mobile "More" sheet */}
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px] md:hidden"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-bone bg-cream/98 px-4 pb-24 pt-4 backdrop-blur-md md:hidden">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-bone" />
            <div className="grid grid-cols-2 gap-2">
              {MORE_NAV.map((n) => {
                const active = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tap flex items-center gap-3 rounded-lg border px-3 text-sm transition-colors active:scale-[0.98]",
                      active
                        ? "border-saffron/40 bg-ink text-cream"
                        : "border-bone bg-paper text-ink/85 hover:border-saffron/40 hover:text-saffron"
                    )}
                  >
                    <n.icon className="size-4 shrink-0" />
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around border-t border-bone bg-cream/95 px-1 py-1.5 backdrop-blur-md md:hidden">
        {BOTTOM_NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all active:scale-95",
                active ? "text-saffron" : "text-ink/60 hover:text-ink"
              )}
            >
              <n.icon className={cn("size-5 transition-transform", active && "scale-110")} />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-label={moreOpen ? "Close more menu" : "More"}
          aria-expanded={moreOpen}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all active:scale-95",
            moreOpen ? "text-saffron" : "text-ink/60 hover:text-ink"
          )}
        >
          {moreOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="truncate">More</span>
        </button>
      </nav>
    </div>
  );
}
