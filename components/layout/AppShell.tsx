"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/network", label: "Network", icon: Users },
  { href: "/collabs", label: "Collabs", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/notifications", label: "Inbox", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="min-h-dvh bg-cream">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-bone bg-cream px-6 py-8 md:flex">
        <div>
          <Link
            href="/home"
            className="font-serif text-2xl font-normal text-ink"
          >
            Collab47.
          </Link>

          <div className="mt-12 flex items-center gap-3 rounded-lg border border-bone bg-paper p-3">
            <Avatar name="Akshpreet" size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">Akshpreet</p>
              <p className="truncate text-xs text-ash">@akshpreet</p>
            </div>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {nav.map((n) => {
              const active = path === n.href || path?.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-ink text-cream"
                      : "text-ink/80 hover:bg-bone"
                  )}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <button className="flex items-center justify-center gap-2 rounded-full bg-saffron px-4 py-3 text-sm font-medium text-cream transition-colors hover:bg-saffron-dk">
          <Plus className="size-4" /> New post
        </button>
      </aside>

      {/* Top bar (mobile + desktop) */}
      <header className="sticky top-0 z-40 border-b border-bone bg-cream/85 backdrop-blur-md md:ml-60">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-8">
          <div className="flex flex-1 items-center gap-3 rounded-full border border-bone bg-paper px-4 py-2 md:max-w-md">
            <Search className="size-4 text-ash" />
            <input
              placeholder="Search people, posts, projects"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ash"
            />
          </div>
          <button className="rounded-full border border-bone bg-paper p-2.5 transition-colors hover:bg-bone">
            <Bell className="size-4 text-ink" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 pb-24 pt-6 md:ml-60 md:px-8 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-bone bg-cream/95 px-2 py-2 backdrop-blur-md md:hidden">
        {nav.slice(0, 5).map((n) => {
          const active = path === n.href || path?.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[10px] transition-colors",
                active ? "text-saffron" : "text-ink/60"
              )}
            >
              <n.icon className="size-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
