"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, BellOff, Bell, Ban } from "lucide-react";
import { blockUserAction, muteConversationAction } from "@/app/(app)/messages/actions";

export function ChatMenu({
  conversationId,
  otherUserId,
  initialMuted = false,
}: {
  conversationId: string;
  otherUserId?: string | null;
  initialMuted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setOpen(false);
    startTransition(async () => {
      const r = await muteConversationAction(conversationId, next);
      if (!r.ok) setMuted(!next);
    });
  }

  function block() {
    if (!otherUserId) return;
    setOpen(false);
    startTransition(async () => {
      const r = await blockUserAction(otherUserId);
      if (r.ok) router.push("/messages");
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={isPending}
        aria-label="Conversation options"
        className="rounded-full p-2 transition-colors hover:bg-bone"
      >
        <MoreHorizontal className="size-4 text-ash" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-bone bg-paper py-1 shadow-lg">
          <button
            onClick={toggleMute}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-bone"
          >
            {muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            {muted ? "Unmute" : "Mute"}
          </button>
          {otherUserId ? (
            <button
              onClick={block}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ember hover:bg-ember/10"
            >
              <Ban className="size-4" /> Block
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
