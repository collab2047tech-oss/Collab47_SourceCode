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
      <div className="flex items-center gap-3 rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:border-saffron">
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
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMessage}
            disabled={msgPending}
          >
            <MessageSquare className="size-3.5" />
            {msgPending ? "Opening..." : "Message"}
          </Button>
          {state.isConnected ? (
            <Button variant="secondary" size="sm" disabled>
              <UserCheck className="size-3.5" />
              Connected
            </Button>
          ) : state.pending ? (
            <Button variant="secondary" size="sm" disabled>
              <CheckCircle className="size-3.5" />
              Pending
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
        <Link href={`/u/${person.handle}`} className="shrink-0">
          <Avatar
            name={person.name}
            src={person.avatar_url ?? undefined}
            size="lg"
          />
        </Link>
        <Link href={`/u/${person.handle}`} className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{person.name}</p>
          <p className="text-xs text-ash">@{person.handle}</p>
          {(person.branch || person.college) && (
            <p className="mt-1 text-sm text-ash">
              {[person.branch, person.college].filter(Boolean).join(" . ")}
            </p>
          )}
        </Link>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleMessage}
          disabled={msgPending}
        >
          <MessageSquare className="size-4" /> {msgPending ? "Opening..." : "Message"}
        </Button>
        {state.isConnected ? (
          <Button variant="secondary" size="sm" className="flex-1" disabled>
            <UserCheck className="size-4" /> Connected
          </Button>
        ) : state.pending ? (
          <Button variant="secondary" size="sm" className="flex-1" disabled>
            <CheckCircle className="size-4" /> Pending
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
