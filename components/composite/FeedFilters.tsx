"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { updateFeedFiltersAction } from "@/app/(app)/home/feedback-actions";

export interface FeedPrefs {
  only_follows: boolean;
  hide_news: boolean;
  hide_projects: boolean;
}

interface Props {
  initial: FeedPrefs;
  onChange?: (prefs: FeedPrefs) => void;
}

const CHIPS: { key: keyof FeedPrefs; label: string }[] = [
  { key: "only_follows", label: "Only people I follow" },
  { key: "hide_news", label: "Hide news" },
  { key: "hide_projects", label: "Hide projects" },
];

export function FeedFilters({ initial, onChange }: Props) {
  const [prefs, setPrefs] = useState<FeedPrefs>(initial);
  const [, start] = useTransition();

  function toggle(key: keyof FeedPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    onChange?.(next);
    start(() => {
      updateFeedFiltersAction(next);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {CHIPS.map((c) => {
        const active = prefs[c.key];
        return (
          <button
            key={c.key}
            onClick={() => toggle(c.key)}
            className={cn(
              "h-8 rounded-full px-4 text-sm transition-colors",
              active
                ? "bg-saffron text-cream"
                : "border border-bone bg-paper text-ink hover:border-ink/30"
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
