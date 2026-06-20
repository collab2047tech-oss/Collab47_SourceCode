"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, BellOff, Bell, Ban, ShieldCheck } from "lucide-react";
import {
  blockUserAction,
  unblockUserAction,
  muteConversationAction,
} from "@/app/(app)/messages/actions";

export function ChatMenu({
  conversationId,
  otherUserId,
  initialMuted = false,
  blockedByMe = false,
}: {
  conversationId: string;
  otherUserId?: string | null;
  initialMuted?: boolean;
  /** True if the current user has blocked the other party (enables Unblock). */
  blockedByMe?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [blocked, setBlocked] = useState(blockedByMe);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Keep local state in sync if the server re-renders with fresh props.
  useEffect(() => setMuted(initialMuted), [initialMuted]);
  useEffect(() => setBlocked(blockedByMe), [blockedByMe]);

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
    setBlocked(true);
    startTransition(async () => {
      const r = await blockUserAction(otherUserId);
      if (r.ok) {
        // Refresh so the thread + composer reflect the blocked state.
        router.refresh();
      } else {
        setBlocked(false);
      }
    });
  }

  function unblock() {
    if (!otherUserId) return;
    setOpen(false);
    setBlocked(false);
    startTransition(async () => {
      const r = await unblockUserAction(otherUserId);
      if (r.ok) {
        router.refresh();
      } else {
        setBlocked(true);
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={isPending}
        aria-label="Conversation options"
        className="rounded-full p-2 transition-colors hover:bg-bone disabled:opacity-50"
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
            blocked ? (
              <button
                onClick={unblock}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-moss hover:bg-moss/10"
              >
                <ShieldCheck className="size-4" /> Unblock
              </button>
            ) : (
              <button
                onClick={block}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ember hover:bg-ember/10"
              >
                <Ban className="size-4" /> Block
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
