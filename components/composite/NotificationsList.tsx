"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import {
  NotificationItem,
  type NotificationItemData,
} from "@/components/composite/NotificationItem";
import { MarkAllReadButton } from "@/components/composite/MarkAllReadButton";
import {
  markAllReadAction,
  markNotificationReadAction,
} from "@/app/(app)/notifications/actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  dayBucket,
  DAY_BUCKET_LABEL,
  type DayBucket,
} from "@/lib/ui/time";

interface RawPayload {
  text?: unknown;
  who?: unknown;
  href?: unknown;
}

/** Map a raw notifications row (from realtime or the server) to view data. */
function mapRow(row: {
  id: string;
  kind: string;
  payload: RawPayload | null;
  created_at: string;
  read_at: string | null;
}): NotificationItemData {
  const p = (row.payload ?? {}) as RawPayload;
  return {
    id: row.id,
    kind: row.kind,
    message: typeof p.text === "string" ? p.text : "New activity",
    who: typeof p.who === "string" ? p.who : "Someone",
    createdAt: row.created_at,
    href: typeof p.href === "string" ? p.href : "/home",
    unread: row.read_at === null,
  };
}

const BUCKET_ORDER: DayBucket[] = ["today", "yesterday", "week", "earlier"];

export function NotificationsList({
  initialItems,
  userId,
}: {
  initialItems: NotificationItemData[];
  userId: string | null;
}) {
  const [items, setItems] = useState<NotificationItemData[]>(initialItems);
  const [, startTransition] = useTransition();

  // Shared clock so every row's relative label re-ticks together each minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Track ids we've already seen so realtime INSERTs never double-insert across
  // a re-subscribe or an echo of our own write.
  const seen = useRef<Set<string>>(new Set(initialItems.map((i) => i.id)));

  const markRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, unread: false } : it))
    );
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  }, []);

  const markAll = useCallback(() => {
    setItems((prev) => prev.map((it) => ({ ...it, unread: false })));
    startTransition(async () => {
      await markAllReadAction();
    });
  }, []);

  // Realtime: prepend brand-new rows + reconcile read state across tabs. This
  // finally uses the notifications realtime publication (migration 0022).
  useEffect(() => {
    if (!userId) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;

    const ch = sb
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Parameters<typeof mapRow>[0];
          if (!row?.id || seen.current.has(row.id)) return;
          seen.current.add(row.id);
          setItems((prev) => [mapRow(row), ...prev]);
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
          const row = payload.new as Parameters<typeof mapRow>[0];
          if (!row?.id) return;
          const unread = row.read_at === null;
          setItems((prev) =>
            prev.map((it) => (it.id === row.id ? { ...it, unread } : it))
          );
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(ch);
    };
  }, [userId]);

  const unreadCount = useMemo(
    () => items.filter((i) => i.unread).length,
    [items]
  );

  // Split into New (unread) then Earlier (read); inside each, bucket by day.
  const sections = useMemo(() => {
    const make = (rows: NotificationItemData[]) => {
      const groups = new Map<DayBucket, NotificationItemData[]>();
      for (const it of rows) {
        const key = dayBucket(it.createdAt, now);
        const arr = groups.get(key);
        if (arr) arr.push(it);
        else groups.set(key, [it]);
      }
      return BUCKET_ORDER.filter((b) => groups.has(b)).map((b) => ({
        bucket: b,
        label: DAY_BUCKET_LABEL[b],
        rows: groups.get(b)!,
      }));
    };
    return {
      unread: make(items.filter((i) => i.unread)),
      read: make(items.filter((i) => !i.unread)),
    };
  }, [items, now]);

  if (items.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-2 py-16 text-center sm:mt-12">
        <span className="flex size-14 items-center justify-center rounded-full border border-bone bg-paper">
          <Bell className="size-6 text-ash" />
        </span>
        <p className="text-ink/70">Nothing yet. Make a post.</p>
      </div>
    );
  }

  return (
    <>
      {/* Action row: count + mark all */}
      <div className="mt-8 flex items-center justify-between gap-3 sm:mt-12">
        <p className="text-caption">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : `${items.length} ${items.length === 1 ? "notification" : "notifications"}`}
        </p>
        <MarkAllReadButton hasUnread={unreadCount > 0} onMarkAll={markAll} />
      </div>

      {/* New (unread) */}
      {sections.unread.length > 0 && (
        <section className="mt-6">
          <h2 className="text-caption text-saffron-dk">New</h2>
          {sections.unread.map((g) => (
            <Group key={`u-${g.bucket}`} label={g.label} rows={g.rows} now={now} onRead={markRead} />
          ))}
        </section>
      )}

      {/* Earlier (read) */}
      {sections.read.length > 0 && (
        <section className="mt-10">
          <h2 className="text-caption">Earlier</h2>
          {sections.read.map((g) => (
            <Group key={`r-${g.bucket}`} label={g.label} rows={g.rows} now={now} onRead={markRead} />
          ))}
        </section>
      )}

      <p className="mt-10 text-center text-caption">
        {items.length} {items.length === 1 ? "notification" : "notifications"} . last 50
      </p>
    </>
  );
}

function Group({
  label,
  rows,
  now,
  onRead,
}: {
  label: string;
  rows: NotificationItemData[];
  now: number;
  onRead: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="px-3 text-xs font-medium uppercase tracking-wide text-ash sm:px-4">
        {label}
      </p>
      <ul className="mt-1 divide-y divide-bone">
        {rows.map((item) => (
          <li key={item.id}>
            <NotificationItem item={item} now={now} onRead={onRead} />
          </li>
        ))}
      </ul>
    </div>
  );
}
