"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { markReadAction } from "@/app/(app)/messages/actions";
import type { MessageWithSender } from "@/lib/db/messages";

interface MessageThreadProps {
  conversationId: string;
  initialMessages: MessageWithSender[];
  currentUserId: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDate(
  messages: MessageWithSender[]
): Array<{ label: string; messages: MessageWithSender[] }> {
  const groups: Record<string, MessageWithSender[]> = {};
  for (const msg of messages) {
    const day = new Date(msg.created_at).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(msg);
  }
  return Object.entries(groups).map(([label, messages]) => ({
    label,
    messages,
  }));
}

export function MessageThread({
  conversationId,
  initialMessages,
  currentUserId,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const [typingVisible, setTypingVisible] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Merge fresh server data when the page revalidates (router.refresh after a
  // send). useState only seeds on mount, so without this a just-sent message
  // would not appear until a full reload if realtime is delayed/unavailable.
  useEffect(() => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const added = initialMessages.filter((m) => !seen.has(m.id));
      if (added.length === 0) return prev;
      return [...prev, ...added].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, [initialMessages]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll on mount and when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Mark read on mount and visibility change
  useEffect(() => {
    markReadAction(conversationId);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markReadAction(conversationId);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;

    const channel = sb
      .channel(`messages:conversation_id=eq.${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as MessageWithSender;

          // Fetch sender profile to attach
          const { data: senderProfile } = await sb
            .from("profiles")
            .select("id, handle, name, avatar_url, college")
            .eq("id", newMsg.sender_id)
            .maybeSingle();

          const msgWithSender: MessageWithSender = {
            ...newMsg,
            sender: senderProfile ?? {
              id: newMsg.sender_id,
              handle: "",
              name: "Unknown",
              avatar_url: null,
              college: null,
            },
          };

          setMessages((prev) => {
            // Avoid duplicate if already in state
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, msgWithSender];
          });

          if (newMsg.sender_id !== currentUserId) {
            markReadAction(conversationId);
          }
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== currentUserId) {
          setTypingVisible(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setTypingVisible(false), 2000);
        }
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, currentUserId]);

  const groups = groupByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar">
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
            {group.messages.map((msg) => {
              const isOwn = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={cn("flex items-end gap-2", isOwn ? "justify-end" : "justify-start")}
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
                      "max-w-md rounded-2xl px-4 py-2.5 text-sm",
                      isOwn
                        ? "rounded-br-md bg-saffron text-cream"
                        : "rounded-bl-md border border-bone bg-paper text-ink"
                    )}
                  >
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="Image attachment"
                        className="mb-2 max-h-48 rounded-lg object-cover"
                      />
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        isOwn ? "text-cream/70" : "text-ash"
                      )}
                    >
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
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
  );
}
