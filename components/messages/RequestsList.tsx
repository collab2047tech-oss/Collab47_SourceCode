"use client";

import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/primitives/Avatar";
import { Reveal } from "@/components/motion/Reveal";
import { AcceptRequestButton } from "@/components/composite/AcceptRequestButton";
import { DeclineRequestButton } from "@/components/composite/DeclineRequestButton";
import { ConversationRail } from "@/components/messages/ConversationRail";
import { useMessagesStore } from "@/components/messages/MessagesProvider";
import { MessageSquare } from "lucide-react";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/**
 * The Requests view. The list comes from MessagesProvider (so Accept/Decline
 * animate the row in/out optimistically), with the shared rail on the left for
 * a desktop two-pane layout consistent with the rest of messaging.
 */
export function RequestsList() {
  const store = useMessagesStore();
  const reduce = useReducedMotion();
  const requests = store?.requests ?? [];

  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem-3.5rem)] md:h-[calc(100dvh-4rem)] grid-cols-1 overflow-hidden md:-mx-8 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
      {/* Shared rail on desktop. */}
      <div className="hidden md:flex md:min-h-0 md:min-w-0 md:flex-col">
        <ConversationRail />
      </div>

      {/* The requests list takes the page on mobile, the right pane on desktop. */}
      <section className="flex min-h-0 min-w-0 flex-col bg-paper md:bg-cream">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              className="text-sm text-ash transition-colors hover:text-ink"
            >
              Inbox
            </Link>
            <span className="text-ash">/</span>
            <span className="text-sm font-semibold text-ink">Requests</span>
          </div>
          <h2 className="mt-3 font-serif text-2xl text-ink">Message Requests</h2>
          <p className="mt-1 text-sm text-ash">
            Messages from people you do not follow yet.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {requests.length === 0 && (
            <Reveal>
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <MessageSquare className="size-8 text-bone" />
                <p className="text-sm text-ash">No message requests.</p>
              </div>
            </Reveal>
          )}
          <AnimatePresence initial={false}>
            {requests.map((req) => (
              <motion.div
                key={req.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex w-full items-start gap-3 border-b border-bone bg-paper px-4 py-4 last:border-0 sm:px-5"
              >
                <Avatar name={req.name} src={req.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{req.name}</p>
                    <p className="shrink-0 text-xs text-ash">
                      {relativeTime(req.lastMessageAt)}
                    </p>
                  </div>
                  <p className="mt-1 truncate text-sm text-ash">{req.last}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AcceptRequestButton conversationId={req.id} />
                    <DeclineRequestButton conversationId={req.id} />
                    <Link
                      href={`/messages/${req.id}`}
                      className="rounded-md border border-bone px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-bone"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
