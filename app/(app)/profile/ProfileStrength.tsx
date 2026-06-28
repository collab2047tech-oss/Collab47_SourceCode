"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StrengthItem } from "./strength";

interface ProfileStrengthProps {
  /** OWNER-ONLY invariant. The component renders nothing unless this is true. */
  isOwner: boolean;
  score: number;
  items: StrengthItem[];
  todo: StrengthItem[];
}

/**
 * Owner-only "Profile strength" meter + actionable checklist.
 *
 * OWNER-ONLY INVARIANT: this component is rendered ONLY from /profile and bails
 * out hard (`if (!isOwner) return null`) so even a future refactor that unifies
 * the owner and visitor pages can never leak the score to a visitor.
 */
export function ProfileStrength({ isOwner, score, items, todo }: ProfileStrengthProps) {
  const [open, setOpen] = useState(false);

  // Hard owner-only guard - refactor-safe.
  if (!isOwner) return null;

  const done = items.length - todo.length;
  const accent = score >= 80 ? "#1B7A4B" : score >= 50 ? "#2C5BFF" : "#F5A623";

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-bone bg-paper">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-cream"
        aria-expanded={open}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(44,91,255,0.10)" }}
        >
          <Sparkles className="size-4" style={{ color: accent }} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink">Profile strength</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>
              {score}%
            </span>
            <span className="text-xs text-ash">Only you can see this</span>
          </span>
          {/* Progress bar */}
          <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-bone">
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${score}%`, background: accent }}
            />
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-ash transition-transform", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <div className="border-t border-bone px-5 py-4">
          <p className="mb-3 text-xs text-ash">
            {done} of {items.length} complete
            {todo.length > 0 ? " - finish these to stand out:" : " - your profile is complete."}
          </p>
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.key}>
                {item.done ? (
                  <span className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ash">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-moss/15">
                      <Check className="size-3 text-moss" strokeWidth={3} />
                    </span>
                    <span className="line-through">{item.label}</span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-cream"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-bone" />
                    <span className="flex-1 group-hover:text-saffron-dk">{item.label}</span>
                    <span
                      className="text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "#2C5BFF" }}
                    >
                      Fix
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
