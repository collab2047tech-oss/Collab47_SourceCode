"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { cn } from "@/lib/cn";
import { MessageSquare, UserCheck, UserPlus, CheckCircle } from "lucide-react";
import type { MiniProfile } from "@/lib/db/social";
import {
  followUserAction,
  unfollowUserAction,
} from "@/app/(app)/network/actions";
import { startConversationAction } from "@/app/(app)/messages/actions";

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msgPending, startMsgTransition] = useTransition();
  const [optimisticFollowing, setOptimisticFollowing] = useState(
    state.isFollowing ?? false
  );

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

  function handleMessage() {
    startMsgTransition(async () => {
      const res = await startConversationAction(person.id);
      if (res.ok && res.conversationId) {
        router.push(`/messages/${res.conversationId}`);
      } else {
        // Fall back to the profile if the conversation could not be created.
        router.push(`/u/${person.handle}`);
      }
    });
  }

  if (variant === "row") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/u/${person.handle}`} className="shrink-0">
            <Avatar
              name={person.name}
              src={person.avatar_url ?? undefined}
              size="sm"
            />
          </Link>
          <Link href={`/u/${person.handle}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
            <p className="truncate text-xs text-ash">@{person.handle}</p>
            {(person.branch || person.college) && (
              <p className="truncate text-xs text-ash">
                {[person.branch, person.college].filter(Boolean).join(" . ")}
              </p>
            )}
          </Link>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={handleMessage}
            disabled={msgPending}
          >
            <MessageSquare className="size-3.5 shrink-0" />
            {msgPending ? "Opening..." : "Message"}
          </Button>
          {state.isConnected ? (
            <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" disabled>
              <UserCheck className="size-3.5 shrink-0" />
              Connected
            </Button>
          ) : state.pending ? (
            <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" disabled>
              <CheckCircle className="size-3.5 shrink-0" />
              Pending
            </Button>
          ) : (
            <Button
              variant={optimisticFollowing ? "secondary" : "primary"}
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={handleFollow}
              disabled={isPending}
            >
              {optimisticFollowing ? (
                <>
                  <UserCheck className="size-3.5 shrink-0" /> Following
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5 shrink-0" /> Follow
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
        "group flex h-full flex-col rounded-lg border border-bone bg-paper p-5 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm sm:p-6"
      )}
    >
      <div className="flex items-start gap-4">
        <Link href={`/u/${person.handle}`} className="shrink-0">
          <Avatar
            name={person.name}
            src={person.avatar_url ?? undefined}
            size="lg"
          />
        </Link>
        <Link href={`/u/${person.handle}`} className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink transition-colors group-hover:text-saffron">{person.name}</p>
          <p className="truncate text-xs text-ash">@{person.handle}</p>
          {(person.branch || person.college) && (
            <p className="mt-1 line-clamp-2 text-sm text-ash">
              {[person.branch, person.college].filter(Boolean).join(" . ")}
            </p>
          )}
        </Link>
      </div>
      <div className="mt-4 flex gap-2 pt-1 sm:mt-auto">
        <Button
          variant="secondary"
          size="sm"
          className="min-w-0 flex-1"
          onClick={handleMessage}
          disabled={msgPending}
        >
          <MessageSquare className="size-4 shrink-0" /> <span className="truncate">{msgPending ? "Opening..." : "Message"}</span>
        </Button>
        {state.isConnected ? (
          <Button variant="secondary" size="sm" className="min-w-0 flex-1" disabled>
            <UserCheck className="size-4 shrink-0" /> <span className="truncate">Connected</span>
          </Button>
        ) : state.pending ? (
          <Button variant="secondary" size="sm" className="min-w-0 flex-1" disabled>
            <CheckCircle className="size-4 shrink-0" /> <span className="truncate">Pending</span>
          </Button>
        ) : (
          <Button
            variant={optimisticFollowing ? "secondary" : "primary"}
            size="sm"
            className="min-w-0 flex-1"
            onClick={handleFollow}
            disabled={isPending}
          >
            {optimisticFollowing ? (
              <>
                <UserCheck className="size-4 shrink-0" /> <span className="truncate">Following</span>
              </>
            ) : (
              <>
                <UserPlus className="size-4 shrink-0" /> <span className="truncate">Follow</span>
              </>
            )}
          </Button>
        )}
      </div>
    </article>
  );
}
