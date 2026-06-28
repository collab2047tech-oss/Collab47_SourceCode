"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  /** Whether there are any unread notifications. Disables the button when false. */
  hasUnread: boolean;
  /**
   * Called when clicked. The parent list owns the optimistic flip (rows go read
   * + the bell badge zeroes instantly) and fires the server action in the
   * background, so this button just delegates.
   */
  onMarkAll: () => void;
}

export function MarkAllReadButton({ hasUnread, onMarkAll }: Props) {
  // Once clicked, reflect "done" locally so the label/disabled state updates
  // instantly even though the parent's optimistic flip is what clears the rows.
  const [done, setDone] = useState(false);
  const disabled = !hasUnread || done;

  function handleClick() {
    if (disabled) return;
    setDone(true);
    onMarkAll();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all",
        disabled
          ? "cursor-default text-ash"
          : "text-saffron hover:bg-saffron/10 hover:text-saffron-dk active:scale-95"
      )}
    >
      <CheckCheck className="size-4 shrink-0" />
      <span className="hidden sm:inline">Mark all as read</span>
      <span className="sm:hidden">Mark read</span>
    </button>
  );
}
