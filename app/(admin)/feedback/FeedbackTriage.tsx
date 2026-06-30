"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { setFeedbackStatusAction } from "@/app/(app)/feedback-actions";
import type { FeedbackStatus } from "@/lib/db/feedback";

const OPTIONS: { value: FeedbackStatus; label: string; active: string }[] = [
  { value: "open", label: "Open", active: "bg-ink text-cream border-ink" },
  { value: "in_progress", label: "In progress", active: "bg-saffron text-cream border-saffron" },
  { value: "resolved", label: "Resolved", active: "bg-moss text-cream border-moss" },
  { value: "wont_fix", label: "Won't fix", active: "bg-ember text-cream border-ember" },
];

/**
 * Per-row status control. Optimistically reflects the chosen status, then calls
 * the server action. On failure it rolls back to the previous status and shows
 * an inline error so the admin is never lied to about state.
 */
export function FeedbackTriage({ id, status }: { id: string; status: FeedbackStatus }) {
  const [current, setCurrent] = useState<FeedbackStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(next: FeedbackStatus) {
    if (next === current || isPending) return;
    const prev = current;
    setCurrent(next); // optimistic
    setError(null);
    startTransition(async () => {
      const res = await setFeedbackStatusAction(id, next);
      if (!res.ok) {
        setCurrent(prev); // roll back
        setError(res.error || "Could not update.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" aria-busy={isPending}>
        {OPTIONS.map((opt) => {
          const isActive = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              disabled={isPending}
              aria-pressed={isActive}
              className={cn(
                "inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-all duration-200 ease-out-soft disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? opt.active
                  : "border-bone bg-paper text-ash hover:border-ink hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-ember">{error}</p> : null}
    </div>
  );
}
