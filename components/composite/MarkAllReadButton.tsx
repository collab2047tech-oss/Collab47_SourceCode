"use client";

import { useState, useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { markAllReadAction } from "@/app/(app)/notifications/actions";

interface Props {
  /** Whether there are any unread notifications. Disables the button when false. */
  hasUnread: boolean;
}

export function MarkAllReadButton({ hasUnread }: Props) {
  const [isPending, startTransition] = useTransition();
  // Once clicked, treat as done locally so the button reflects the new state
  // immediately even before the revalidation round-trip resolves.
  const [done, setDone] = useState(false);

  const disabled = !hasUnread || done || isPending;

  function handleClick() {
    if (disabled) return;
    setDone(true);
    startTransition(async () => {
      const res = await markAllReadAction();
      if (!res.ok) setDone(false);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        disabled
          ? "cursor-default text-ash"
          : "text-saffron hover:bg-saffron/10 hover:text-saffron-dk"
      )}
    >
      <CheckCheck className="size-4" />
      {isPending ? "Marking..." : "Mark all as read"}
    </button>
  );
}
