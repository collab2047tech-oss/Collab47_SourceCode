"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { iconForKind } from "@/lib/ui/notificationKind";
import { absoluteTime, relativeTime } from "@/lib/ui/time";

export interface NotificationItemData {
  id: string;
  kind: string;
  /** Full message INCLUDING the actor name, e.g. "Asha started following you". */
  message: string;
  /** Actor display name. Used for the avatar + bolding the leading name only. */
  who: string;
  /** Raw ISO timestamp straight from the DB. Formatted client-side. */
  createdAt: string;
  href: string;
  unread: boolean;
}

/**
 * A single, clickable notification row. Clicking marks the notification read
 * (handled by the parent list, which owns optimistic state + the bell badge)
 * and routes to the notification's target. Time is rendered client-side as a
 * relative label with the exact local timestamp on hover.
 *
 * `now` is threaded from the parent so every row re-renders its relative label
 * together on a shared 60s tick.
 */
export function NotificationItem({
  item,
  now,
  onRead,
}: {
  item: NotificationItemData;
  now: number;
  /** Called on a plain left-click of an unread row, before navigation. */
  onRead: (id: string) => void;
}) {
  const router = useRouter();
  const Icon = iconForKind(item.kind);

  function handleClick(e: React.MouseEvent) {
    // Let modifier-clicks / middle-clicks fall through so users can open in a
    // new tab; only intercept a plain left-click.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    if (item.unread) onRead(item.id);
    router.push(item.href);
  }

  // The message already begins with the actor name; bold just that leading span
  // instead of printing the name a second time (the old "Asha Asha ..." bug).
  const startsWithWho =
    item.who && item.message.toLowerCase().startsWith(item.who.toLowerCase());

  return (
    <a
      href={item.href}
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 rounded-md py-4 pr-2 transition-colors hover:bg-paper active:bg-bone/40 sm:gap-4 sm:py-5",
        item.unread
          ? "border-l-2 border-saffron bg-saffron/6 pl-3 sm:pl-4"
          : "border-l-2 border-transparent pl-3 sm:pl-4"
      )}
    >
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-bone">
        <Icon className="size-4 text-ink" />
        {item.unread ? (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-saffron ring-2 ring-cream" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-base text-ink", item.unread && "font-medium")}>
          {startsWithWho ? (
            <>
              <span className="font-semibold">{item.message.slice(0, item.who.length)}</span>
              {item.message.slice(item.who.length)}
            </>
          ) : (
            item.message
          )}
        </p>
        <time
          dateTime={item.createdAt}
          title={absoluteTime(item.createdAt)}
          className="mt-1 block text-xs text-ash"
        >
          {relativeTime(item.createdAt, now)}
        </time>
      </div>
      <Avatar name={item.who} size="sm" className="hidden shrink-0 sm:inline-flex" />
    </a>
  );
}
