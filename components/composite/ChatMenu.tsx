"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { MoreHorizontal, BellOff, Bell, Ban, ShieldCheck } from "lucide-react";
import {
  blockUserAction,
  unblockUserAction,
  muteConversationAction,
} from "@/app/(app)/messages/actions";
import { useThread } from "@/components/messages/ThreadProvider";

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
  const { setBlockedByMenu } = useThread();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [blocked, setBlocked] = useState(blockedByMe);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Seed the composer's blocked footer from the server-resolved state.
  useEffect(() => setBlockedByMenu(blockedByMe), [blockedByMe, setBlockedByMenu]);

  // Keep local state in sync if the server re-renders with fresh props.
  useEffect(() => setMuted(initialMuted), [initialMuted]);
  useEffect(() => setBlocked(blockedByMe), [blockedByMe]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
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
    // Optimistic: flip the composer to the blocked footer instantly (no reload).
    setBlocked(true);
    setBlockedByMenu(true);
    startTransition(async () => {
      const r = await blockUserAction(otherUserId);
      if (!r.ok) {
        setBlocked(false);
        setBlockedByMenu(false);
      }
    });
  }

  function unblock() {
    if (!otherUserId) return;
    setOpen(false);
    setBlocked(false);
    setBlockedByMenu(false);
    startTransition(async () => {
      const r = await unblockUserAction(otherUserId);
      if (!r.ok) {
        setBlocked(true);
        setBlockedByMenu(true);
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        disabled={isPending}
        aria-label="Conversation options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-bone active:scale-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
      >
        <MoreHorizontal className="size-4 text-ash" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Conversation options"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-bone bg-paper py-1 shadow-lg"
        >
          <button
            role="menuitem"
            onClick={toggleMute}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-bone focus-visible:bg-bone focus-visible:outline-none"
          >
            {muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            {muted ? "Unmute" : "Mute"}
          </button>
          {otherUserId ? (
            blocked ? (
              <button
                role="menuitem"
                onClick={unblock}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-moss hover:bg-moss/10 focus-visible:bg-moss/10 focus-visible:outline-none"
              >
                <ShieldCheck className="size-4" /> Unblock
              </button>
            ) : (
              <button
                role="menuitem"
                onClick={block}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ember hover:bg-ember/10 focus-visible:bg-ember/10 focus-visible:outline-none"
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
