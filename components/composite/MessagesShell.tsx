"use client";

import { MessageSquare } from "lucide-react";
import { ConversationRail } from "@/components/messages/ConversationRail";

/**
 * The messages index shell: the shared ConversationRail on the left + an empty
 * right-pane placeholder on desktop. The rail reads its data from
 * MessagesProvider, so this is a thin two-pane wrapper with no list logic of its
 * own (the old hand-rolled rail lived here and was duplicated in the thread
 * page; both now use the single ConversationRail component).
 */
export function MessagesShell() {
  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem-4rem)] md:h-[calc(100dvh-4rem)] grid-cols-1 overflow-hidden md:-mx-8 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
      <ConversationRail />

      {/* Empty right pane placeholder - hidden on mobile (list is the page). */}
      <section className="hidden flex-col items-center justify-center gap-3 bg-cream px-6 text-center md:flex">
        <span className="flex size-16 items-center justify-center rounded-full border border-bone bg-paper">
          <MessageSquare className="size-7 text-ash" />
        </span>
        <p className="text-sm text-ash">Select a conversation to read messages.</p>
      </section>
    </div>
  );
}
