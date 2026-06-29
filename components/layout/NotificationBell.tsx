"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Live notification bell for the top bar. AppShell used to render the unread
 * badge from a STATIC server prop computed once per render, so it never moved
 * until a full reload. This seeds from that same server count for first paint,
 * then opens ONE realtime channel (the notifications publication, migration
 * 0022) and keeps the count live: an INSERT for this user increments, and an
 * UPDATE that flips read_at from null -> set decrements. The subscription
 * pattern mirrors NotificationsList. The badge markup is copied verbatim from
 * AppShell so the bell looks identical.
 */
export function NotificationBell({
  initialCount,
  userId,
  href,
}: {
  initialCount: number;
  userId: string;
  href: string;
}) {
  const [count, setCount] = useState(initialCount);

  // Re-seed if the server count changes across a navigation/revalidate.
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // Track ids we've already counted so an INSERT echo / re-subscribe never
  // double-increments, and so an UPDATE only decrements rows we know were unread.
  const seenUnread = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;

    const ch = sb
      .channel(`notif-bell:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; read_at?: string | null };
          if (!row?.id || seenUnread.current.has(row.id)) return;
          // Brand-new notifications arrive unread.
          if (row.read_at == null) {
            seenUnread.current.add(row.id);
            setCount((n) => n + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; read_at?: string | null };
          if (!row?.id) return;
          // read_at became non-null -> this row was just read; drop it once.
          if (row.read_at != null && seenUnread.current.has(row.id)) {
            seenUnread.current.delete(row.id);
            setCount((n) => Math.max(0, n - 1));
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(ch);
    };
  }, [userId]);

  const badge = count > 9 ? "9+" : count > 0 ? String(count) : null;

  return (
    <Link
      href={href}
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
  );
}
