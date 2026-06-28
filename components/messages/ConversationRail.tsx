"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { Search, MessageSquare, Users, ImageIcon } from "lucide-react";
import { NewGroupModal } from "@/components/composite/NewGroupModal";
import {
  useMessagesStore,
  type RailConversation,
} from "@/components/messages/MessagesProvider";

/** Compact relative time, computed on the client so it stays correct on idle. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

interface RailRowProps {
  conv: RailConversation;
  active: boolean;
  reduce: boolean;
}

function RailRow({ conv, active, reduce }: RailRowProps) {
  // Render "Photo" as a small media glyph + label so it reads as media, not copy.
  const isPhoto = conv.last === "Photo";
  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/messages/${conv.id}`}
        prefetch
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex w-full items-start gap-3 border-b border-bone/60 px-4 py-4 text-left transition-colors active:scale-[0.99] active:bg-bone/60 sm:px-5",
          active ? "bg-bone/60" : "hover:bg-bone/40"
        )}
      >
        {conv.isGroup ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-moss/15 text-moss">
            <Users className="size-5" />
          </span>
        ) : (
          <Avatar name={conv.name} src={conv.avatarUrl} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-ink">{conv.name}</p>
            <p className="shrink-0 text-xs text-ash">
              {relativeTime(conv.lastMessageAt)}
            </p>
          </div>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1 truncate text-sm",
              conv.unread ? "font-medium text-ink" : "text-ash"
            )}
          >
            {isPhoto && <ImageIcon className="size-3.5 shrink-0 text-ash" />}
            <span className="truncate">{conv.last}</span>
          </p>
        </div>
        {conv.unread && (
          <span className="mt-2 size-2 shrink-0 rounded-full bg-saffron" />
        )}
      </Link>
    </motion.div>
  );
}

/**
 * The single, shared conversation rail. Used on the messages index AND inside
 * every thread route, reading its data from MessagesProvider (no per-navigation
 * re-fetch). Client `<Link prefetch>` rows mean switching chats swaps only the
 * right pane. `activeId` highlights the open thread.
 */
export function ConversationRail({ activeId }: { activeId?: string }) {
  const store = useMessagesStore();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<"inbox" | "requests">("inbox");
  const [search, setSearch] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);

  const conversations = store?.conversations ?? [];
  const requests = store?.requests ?? [];

  const active =
    activeId ??
    (pathname?.startsWith("/messages/")
      ? pathname.split("/")[2] || undefined
      : undefined);

  const list = tab === "inbox" ? conversations : requests;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [list, search]);

  return (
    <aside className="flex min-h-0 min-w-0 flex-col bg-paper md:border-r md:border-bone">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-2xl text-ink">Messages</h2>
          <button
            onClick={() => setGroupOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-bone bg-cream px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream active:scale-95"
          >
            <Users className="size-3.5" />
            New group
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="mt-4 flex gap-1 rounded-lg bg-cream p-1">
          <button
            onClick={() => setTab("inbox")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98]",
              tab === "inbox"
                ? "bg-paper text-ink shadow-sm"
                : "text-ash hover:text-ink"
            )}
          >
            Inbox
            {conversations.length > 0 && (
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  tab === "inbox" ? "text-ash" : "text-ash"
                )}
              >
                {conversations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("requests")}
            className={cn(
              "relative flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98]",
              tab === "requests"
                ? "bg-paper text-ink shadow-sm"
                : "text-ash hover:text-ink"
            )}
          >
            Requests
            {requests.length > 0 && (
              <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-saffron text-[10px] font-semibold text-cream">
                {requests.length > 9 ? "9+" : requests.length}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 flex items-center gap-2 rounded-full border border-bone bg-cream px-4 py-2.5">
          <Search className="size-4 shrink-0 text-ash" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ash"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <MessageSquare className="size-8 text-bone" />
            <p className="text-sm text-ash">
              {search.trim()
                ? "No matches."
                : tab === "inbox"
                ? "No conversations yet."
                : "No message requests."}
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {filtered.map((conv) => (
            <RailRow
              key={conv.id}
              conv={conv}
              active={conv.id === active}
              reduce={!!reduce}
            />
          ))}
        </AnimatePresence>
      </div>

      <NewGroupModal open={groupOpen} onClose={() => setGroupOpen(false)} />
    </aside>
  );
}
