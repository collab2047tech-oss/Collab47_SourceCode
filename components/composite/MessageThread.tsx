"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { ArrowDown, Clock, Loader2, AlertCircle, ChevronUp } from "lucide-react";
import { useThread, type ThreadMessage } from "@/components/messages/ThreadProvider";

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDate(
  messages: ThreadMessage[]
): Array<{ label: string; messages: ThreadMessage[] }> {
  const groups: Record<string, ThreadMessage[]> = {};
  const order: string[] = [];
  for (const msg of messages) {
    const day = new Date(msg.created_at).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    if (!groups[day]) {
      groups[day] = [];
      order.push(day);
    }
    groups[day].push(msg);
  }
  return order.map((label) => ({ label, messages: groups[label] }));
}

const NEAR_BOTTOM_PX = 120;

export function MessageThread({
  conversationId,
  currentUserId,
}: MessageThreadProps) {
  const { messages, lastSeenOwnId, loadEarlier, hasMore, loadingEarlier } =
    useThread();
  const [typingVisible, setTypingVisible] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();

  // Track whether the user is near the bottom so new messages don't hijack a
  // scrolled-up reader. Also remember the last message id we accounted for.
  const isNearBottomRef = useRef(true);
  const lastCountRef = useRef(messages.length);
  const lastBottomIdRef = useRef<string | null>(null);
  const didInitialScrollRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setNewCount(0);
  }, []);

  // First mount: jump to bottom INSTANTLY (no top->bottom slide).
  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return;
    scrollToBottom("auto");
    didInitialScrollRef.current = true;
    lastBottomIdRef.current = messages[messages.length - 1]?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distance < NEAR_BOTTOM_PX;
    if (isNearBottomRef.current && newCount > 0) setNewCount(0);
  }

  // On a new message: auto-scroll if the reader is near the bottom OR the new
  // message is their own; otherwise surface the "new messages" pill.
  useEffect(() => {
    if (!didInitialScrollRef.current) return;
    if (messages.length <= lastCountRef.current) {
      lastCountRef.current = messages.length;
      return;
    }
    lastCountRef.current = messages.length;
    const last = messages[messages.length - 1];
    if (!last || last.id === lastBottomIdRef.current) return;
    lastBottomIdRef.current = last.id;

    const isOwn = last.sender_id === currentUserId;
    if (isOwn || isNearBottomRef.current) {
      scrollToBottom(reduce ? "auto" : "smooth");
    } else {
      setNewCount((n) => n + 1);
    }
  }, [messages, currentUserId, reduce, scrollToBottom]);

  // Typing indicator rides a separate broadcast channel.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const typingChannel = sb
      .channel(`typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== currentUserId) {
          setTypingVisible(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setTypingVisible(false), 2000);
        }
      })
      .subscribe();
    return () => {
      sb.removeChannel(typingChannel);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, currentUserId]);

  // "Load earlier" preserving scroll position: measure height before/after.
  const handleLoadEarlier = useCallback(async () => {
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    await loadEarlier();
    requestAnimationFrame(() => {
      const next = scrollRef.current;
      if (!next) return;
      next.scrollTop = prevTop + (next.scrollHeight - prevHeight);
    });
  }, [loadEarlier]);

  const groups = groupByDate(messages);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-3 py-6 no-scrollbar sm:px-6 sm:py-8"
      >
        {hasMore && messages.length > 0 && (
          <div className="mb-4 flex justify-center">
            <button
              onClick={handleLoadEarlier}
              disabled={loadingEarlier}
              className="flex items-center gap-1.5 rounded-full border border-bone bg-paper px-4 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-bone active:scale-95 disabled:opacity-50"
            >
              {loadingEarlier ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
              {loadingEarlier ? "Loading" : "Load earlier"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-ash">No messages yet.</p>
            <p className="mt-1 text-sm text-ash">Start the conversation.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-caption mb-4 mt-2 text-center">{group.label}</p>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {group.messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUserId;
                  const imageSrc = msg.image_url ?? msg.localImageUrl ?? null;
                  return (
                    <motion.div
                      key={msg.client_id ?? msg.id}
                      layout={reduce ? false : "position"}
                      initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: reduce ? 0 : 0.22,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={cn(
                        "flex items-end gap-2",
                        isOwn ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isOwn && (
                        <Avatar
                          name={msg.sender?.name ?? "?"}
                          src={msg.sender?.avatar_url ?? undefined}
                          size="xs"
                          className="mb-1 shrink-0"
                        />
                      )}
                      <div
                        className={cn(
                          "min-w-0 max-w-[78%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-md",
                          isOwn
                            ? "rounded-br-md bg-saffron text-cream"
                            : "rounded-bl-md border border-bone bg-paper text-ink",
                          msg.status === "failed" && "opacity-80"
                        )}
                      >
                        {imageSrc && (
                          <div className="mb-2 overflow-hidden rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageSrc}
                              alt="Image attachment"
                              className={cn(
                                "max-h-60 w-full max-w-full object-cover transition-opacity",
                                msg.status === "sending" && "opacity-70"
                              )}
                            />
                          </div>
                        )}
                        {msg.body && (
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        )}
                        <p
                          className={cn(
                            "mt-1 flex items-center justify-end gap-1 text-[10px]",
                            isOwn ? "text-cream/90" : "text-ash"
                          )}
                        >
                          {msg.status === "sending" ? (
                            <>
                              <Clock className="size-3 animate-pulse" />
                              <span>Sending</span>
                            </>
                          ) : (
                            <>
                              {formatTime(msg.created_at)}
                              {isOwn && msg.id === lastSeenOwnId && (
                                <span className="font-medium text-cream">
                                  {" "}· Seen
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      {isOwn && msg.status === "failed" && (
                        <RetryFailed clientId={msg.client_id} />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}

        {typingVisible && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-bone bg-paper px-4 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-ash [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-ash [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-ash" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* "New messages" pill - high contrast saffron, only when scrolled up. */}
      <AnimatePresence>
        {newCount > 0 && (
          <motion.button
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={() => scrollToBottom(reduce ? "auto" : "smooth")}
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-saffron px-4 py-2 text-xs font-semibold text-cream shadow-lg transition-transform active:scale-95"
          >
            <ArrowDown className="size-3.5" />
            {newCount} new {newCount === 1 ? "message" : "messages"}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tap-to-retry affordance on a failed own message. The composer owns the
 * actual re-send (it has the upload + action wiring); we only signal intent. */
function RetryFailed({ clientId }: { clientId: string | null }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!clientId) return;
        window.dispatchEvent(
          new CustomEvent("c47:dm:retry", { detail: { clientId } })
        );
      }}
      aria-label="Retry sending"
      className="mb-1 flex items-center gap-1 rounded-full bg-cream px-2 py-1 text-[10px] font-semibold text-ember transition-colors hover:bg-bone"
    >
      <AlertCircle className="size-3" />
      Not delivered · Retry
    </button>
  );
}
