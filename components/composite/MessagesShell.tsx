"use client";

import { useState } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { Search, MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { NewGroupModal } from "@/components/composite/NewGroupModal";

export interface ConversationListItem {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  last: string;
  time: string;
  unread: boolean;
  href: string;
  isGroup?: boolean;
}

interface MessagesShellProps {
  inboxItems: ConversationListItem[];
  requestItems: ConversationListItem[];
  requestCount: number;
}

export function MessagesShell({
  inboxItems,
  requestItems,
  requestCount,
}: MessagesShellProps) {
  const [tab, setTab] = useState<"inbox" | "requests">("inbox");
  const [search, setSearch] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);

  const items = tab === "inbox" ? inboxItems : requestItems;
  const filtered = search.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem-3.5rem)] md:h-[calc(100dvh-4rem)] grid-cols-1 overflow-hidden md:-mx-8 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
      {/* Left rail — full width on mobile, fixed rail on md+ */}
      <aside className="flex min-w-0 flex-col bg-paper md:border-r md:border-bone">
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
              {inboxItems.length > 0 && (
                <span className="ml-1.5 text-xs text-ash">{inboxItems.length}</span>
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
              {requestCount > 0 && (
                <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-saffron text-[10px] font-semibold text-cream">
                  {requestCount > 9 ? "9+" : requestCount}
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
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ash"
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
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex w-full items-start gap-3 border-b border-bone/60 px-4 py-4 text-left transition-colors hover:bg-bone/40 active:bg-bone/60 sm:px-5"
            >
              {item.isGroup ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-moss/15 text-moss">
                  <Users className="size-5" />
                </span>
              ) : (
                <Avatar name={item.name} src={item.avatarUrl} size="md" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">
                    {item.name}
                  </p>
                  <p className="shrink-0 text-xs text-ash">{item.time}</p>
                </div>
                <p className="mt-0.5 truncate text-sm text-ash">{item.last}</p>
              </div>
              {item.unread && (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-saffron" />
              )}
            </Link>
          ))}
        </div>
      </aside>

      {/* Empty right pane placeholder — hidden on mobile (list is the page) */}
      <section className="hidden flex-col items-center justify-center gap-3 bg-cream px-6 text-center md:flex">
        <span className="flex size-16 items-center justify-center rounded-full border border-bone bg-paper">
          <MessageSquare className="size-7 text-ash" />
        </span>
        <p className="text-sm text-ash">Select a conversation to read messages.</p>
      </section>

      <NewGroupModal open={groupOpen} onClose={() => setGroupOpen(false)} />
    </div>
  );
}
