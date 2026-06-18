"use client";

import { useState } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { Search, MessageSquare } from "lucide-react";
import Link from "next/link";

export interface ConversationListItem {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  last: string;
  time: string;
  unread: boolean;
  href: string;
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

  const items = tab === "inbox" ? inboxItems : requestItems;
  const filtered = search.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem)] grid-cols-[340px_1fr] md:-mx-8">
      {/* Left rail */}
      <aside className="flex flex-col border-r border-bone bg-paper">
        <div className="p-5">
          <h2 className="font-serif text-2xl text-ink">Messages</h2>

          {/* Sub-tabs */}
          <div className="mt-4 flex gap-1 rounded-lg bg-cream p-1">
            <button
              onClick={() => setTab("inbox")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "inbox"
                  ? "bg-paper text-ink shadow-sm"
                  : "text-ash hover:text-ink"
              )}
            >
              Inbox
            </button>
            <button
              onClick={() => setTab("requests")}
              className={cn(
                "relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
          <div className="mt-3 flex items-center gap-2 rounded-full border border-bone bg-cream px-4 py-2">
            <Search className="size-4 shrink-0 text-ash" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ash"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <MessageSquare className="size-8 text-bone" />
              <p className="text-sm text-ash">
                {tab === "inbox" ? "No conversations yet." : "No message requests."}
              </p>
            </div>
          )}
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-bone/40"
            >
              <Avatar name={item.name} src={item.avatarUrl} size="md" />
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

      {/* Empty right pane placeholder */}
      <section className="flex flex-col items-center justify-center gap-3 bg-cream">
        <MessageSquare className="size-10 text-bone" />
        <p className="text-sm text-ash">Select a conversation to read messages.</p>
      </section>
    </div>
  );
}
