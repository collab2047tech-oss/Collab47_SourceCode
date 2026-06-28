"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { UserPlus, UserCheck } from "lucide-react";
import { followUserAction, unfollowUserAction } from "@/app/(app)/network/actions";

interface SuggestedFollowRowProps {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  initialFollowing?: boolean;
}

/**
 * Compact people-to-follow row for the narrow home right rail: avatar + name +
 * a single OPTIMISTIC Follow toggle (instant flip, rollback on failure). Real
 * server action - never a dead button.
 */
export function SuggestedFollowRow({
  id,
  name,
  handle,
  avatarUrl,
  subtitle,
  initialFollowing = false,
}: SuggestedFollowRowProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next); // optimistic
    start(async () => {
      const res = next ? await followUserAction(id) : await unfollowUserAction(id);
      if (!res.ok) setFollowing(!next); // rollback
    });
  }

  return (
    <div className="group -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-bone/50">
      <Link href={`/u/${handle}`} className="shrink-0">
        <Avatar name={name} src={avatarUrl ?? undefined} size="sm" />
      </Link>
      <Link href={`/u/${handle}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink transition-colors group-hover:text-saffron">
          {name}
        </p>
        {subtitle ? <p className="truncate text-xs text-ash">{subtitle}</p> : null}
      </Link>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        aria-label={following ? `Following ${name}` : `Follow ${name}`}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50",
          following
            ? "border border-bone text-ash hover:border-ember/40 hover:text-ember"
            : "bg-saffron text-cream hover:bg-saffron-dk"
        )}
      >
        {following ? (
          <>
            <UserCheck className="size-3" /> Following
          </>
        ) : (
          <>
            <UserPlus className="size-3" /> Follow
          </>
        )}
      </button>
    </div>
  );
}
