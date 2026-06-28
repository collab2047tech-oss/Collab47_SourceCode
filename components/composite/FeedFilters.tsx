"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { updateFeedFiltersAction } from "@/app/(app)/home/feedback-actions";
import { Users, FolderGit2 } from "lucide-react";

export interface FeedPrefs {
  only_follows: boolean;
  hide_projects: boolean;
}

interface Props {
  initial: FeedPrefs;
  onChange?: (prefs: FeedPrefs) => void;
}

// Only chips that genuinely change every tab's stream. (The old "Hide news" chip
// controlled nothing - there are no news cards in the feed - so it was removed.)
const CHIPS: { key: keyof FeedPrefs; label: string; icon: React.ElementType }[] = [
  { key: "only_follows", label: "People I follow", icon: Users },
  { key: "hide_projects", label: "Hide projects", icon: FolderGit2 },
];

export function FeedFilters({ initial, onChange }: Props) {
  const [prefs, setPrefs] = useState<FeedPrefs>(initial);
  const [, start] = useTransition();

  function toggle(key: keyof FeedPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    onChange?.(next);
    // Persist in the background. The action no longer revalidates /home, so the
    // optimistic client feed is never blown away.
    start(() => {
      void updateFeedFiltersAction(next);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {CHIPS.map((c) => {
        const active = prefs[c.key];
        const Icon = c.icon;
        return (
          <button
            key={c.key}
            onClick={() => toggle(c.key)}
            aria-pressed={active}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors active:scale-95",
              active
                ? "bg-saffron text-cream shadow-sm shadow-saffron/20"
                : "border border-bone bg-paper text-ink hover:border-ink/30"
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
