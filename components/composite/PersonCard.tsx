"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { cn } from "@/lib/cn";
import { MessageSquare, UserCheck, UserPlus, CheckCircle } from "lucide-react";
import type { MiniProfile } from "@/lib/db/social";
import {
  followUserAction,
  unfollowUserAction,
  acceptConnectionAction,
} from "@/app/(app)/network/actions";

export interface PersonCardState {
  isFollowing?: boolean;
  isConnected?: boolean;
  pending?: boolean;
}

interface PersonCardProps {
  person: MiniProfile;
  state?: PersonCardState;
  variant?: "grid" | "row";
}

export function PersonCard({ person, state = {}, variant = "grid" }: PersonCardProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticFollowing, setOptimisticFollowing] = useState(
    state.isFollowing ?? false
  );
  const [accepted, setAccepted] = useState(false);

  function handleFollow() {
    const next = !optimisticFollowing;
    setOptimisticFollowing(next);
    startTransition(async () => {
      if (next) {
        await followUserAction(person.id);
      } else {
        await unfollowUserAction(person.id);
      }
    });
  }

  function handleAccept() {
    startTransition(async () => {
      await acceptConnectionAction(person.id);
      setAccepted(true);
    });
  }

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:border-saffron">
        <Avatar
          name={person.name}
          src={person.avatar_url ?? undefined}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
          <p className="truncate text-xs text-ash">@{person.handle}</p>
          {(person.branch || person.college) && (
            <p className="truncate text-xs text-ash">
              {[person.branch, person.college].filter(Boolean).join(" . ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/u/${person.handle}`}>
            <Button variant="secondary" size="sm">
              <MessageSquare className="size-3.5" />
              Message
            </Button>
          </Link>
          {state.pending && !accepted ? (
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isPending}
            >
              <CheckCircle className="size-3.5" />
              Accept
            </Button>
          ) : (
            <Button
              variant={optimisticFollowing ? "secondary" : "primary"}
              size="sm"
              onClick={handleFollow}
              disabled={isPending}
            >
              {optimisticFollowing ? (
                <>
                  <UserCheck className="size-3.5" /> Following
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" /> Follow
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // grid variant
  return (
    <article
      className={cn(
        "group rounded-lg border border-bone bg-paper p-6 transition-all hover:border-saffron"
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar
          name={person.name}
          src={person.avatar_url ?? undefined}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{person.name}</p>
          <p className="text-xs text-ash">@{person.handle}</p>
          {(person.branch || person.college) && (
            <p className="mt-1 text-sm text-ash">
              {[person.branch, person.college].filter(Boolean).join(" . ")}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/u/${person.handle}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            <MessageSquare className="size-4" /> Message
          </Button>
        </Link>
        {state.pending && !accepted ? (
          <Button
            size="sm"
            className="flex-1"
            onClick={handleAccept}
            disabled={isPending}
          >
            <CheckCircle className="size-4" /> Accept
          </Button>
        ) : (
          <Button
            variant={optimisticFollowing ? "secondary" : "primary"}
            size="sm"
            className="flex-1"
            onClick={handleFollow}
            disabled={isPending}
          >
            {optimisticFollowing ? (
              <>
                <UserCheck className="size-4" /> Following
              </>
            ) : (
              <>
                <UserPlus className="size-4" /> Follow
              </>
            )}
          </Button>
        )}
      </div>
    </article>
  );
}
