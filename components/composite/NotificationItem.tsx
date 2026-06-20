"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { markNotificationReadAction } from "@/app/(app)/notifications/actions";

export interface NotificationItemData {
  id: string;
  kind: string;
  text: string;
  who: string;
  when: string;
  href: string;
  unread: boolean;
}

/**
 * A single, clickable notification row. Clicking marks the notification read
 * (clearing its dot + decrementing the bell badge) and then routes to the
 * notification's target. Renders a per-kind icon supplied by the page.
 */
export function NotificationItem({
  item,
  icon,
}: {
  item: NotificationItemData;
  icon: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Optimistically clear the unread state the instant the row is clicked.
  const [read, setRead] = useState(!item.unread);

  function handleClick(e: React.MouseEvent) {
    // Let modifier-clicks / middle-clicks fall through to the browser so users
    // can still open in a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();

    const go = () => router.push(item.href);

    if (item.unread && !read) {
      setRead(true);
      startTransition(async () => {
        await markNotificationReadAction(item.id);
      });
    }
    go();
  }

  const unread = item.unread && !read;

  return (
    <a
      href={item.href}
      onClick={handleClick}
      className={cn(
        "flex items-start gap-4 rounded-md px-2 py-5 transition-colors hover:bg-paper",
        unread ? "bg-saffron/5" : ""
      )}
    >
      <div className="relative flex size-10 items-center justify-center rounded-full bg-bone">
        {icon}
        {unread ? (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-saffron ring-2 ring-cream" />
        ) : null}
      </div>
      <div className="flex-1">
        <p className="text-base text-ink">
          <span className="font-semibold">{item.who}</span> {item.text}
        </p>
        <p className="mt-1 text-xs text-ash">{item.when}</p>
      </div>
      <Avatar name={item.who} size="sm" />
    </a>
  );
}
