"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { cn } from "@/lib/cn";
import {
  MessageSquare,
  UserCheck,
  UserPlus,
  Clock,
  Link2,
  Sparkles,
} from "lucide-react";
import type { MiniProfile } from "@/lib/db/social";
import {
  followUserAction,
  unfollowUserAction,
  requestConnectionAction,
  cancelConnectionAction,
} from "@/app/(app)/network/actions";
import { startConversationAction } from "@/app/(app)/messages/actions";

export interface PersonCardState {
  isFollowing?: boolean;
  isConnected?: boolean;
  pending?: boolean;
}

type ConnState = "none" | "pending" | "connected";

interface PersonCardProps {
  person: MiniProfile;
  state?: PersonCardState;
  variant?: "grid" | "row";
  /** Optional "why suggested" chip (e.g. "Same college", "3 mutual connections"). */
  reason?: string;
}

export function PersonCard({ person, state = {}, variant = "grid", reason }: PersonCardProps) {
  const router = useRouter();
  const [followPending, startFollow] = useTransition();
  const [connPending, startConn] = useTransition();
  const [msgPending, startMsgTransition] = useTransition();

  const [optimisticFollowing, setOptimisticFollowing] = useState(
    state.isFollowing ?? false
  );
  const [conn, setConn] = useState<ConnState>(
    state.isConnected ? "connected" : state.pending ? "pending" : "none"
  );

  function handleFollow() {
    const next = !optimisticFollowing;
    // Optimistic: flip instantly, sync in the background, roll back on failure.
    setOptimisticFollowing(next);
    startFollow(async () => {
      const res = next
        ? await followUserAction(person.id)
        : await unfollowUserAction(person.id);
      if (!res.ok) setOptimisticFollowing(!next);
    });
  }

  function handleConnect() {
    if (conn === "connected") return;
    if (conn === "pending") {
      // Cancel an outgoing request - optimistic revert.
      setConn("none");
      startConn(async () => {
        const res = await cancelConnectionAction(person.id);
        if (!res.ok) setConn("pending");
      });
      return;
    }
    // none -> pending
    setConn("pending");
    startConn(async () => {
      const res = await requestConnectionAction(person.id);
      if (!res.ok) setConn("none");
    });
  }

  function handleMessage() {
    startMsgTransition(async () => {
      const res = await startConversationAction(person.id);
      if (res.ok && res.conversationId) {
        router.push(`/messages/${res.conversationId}`);
      } else {
        router.push(`/u/${person.handle}`);
      }
    });
  }

  const followBtn = (size: "sm", iconCls: string) => (
    <Button
      variant={optimisticFollowing ? "secondary" : "primary"}
      size={size}
      className="min-w-0 flex-1"
      onClick={handleFollow}
      disabled={followPending}
      aria-pressed={optimisticFollowing}
    >
      {optimisticFollowing ? (
        <>
          <UserCheck className={iconCls} /> <span className="truncate">Following</span>
        </>
      ) : (
        <>
          <UserPlus className={iconCls} /> <span className="truncate">Follow</span>
        </>
      )}
    </Button>
  );

  const connectBtn = (size: "sm", iconCls: string) => {
    if (conn === "connected") {
      return (
        <Button variant="secondary" size={size} className="min-w-0 flex-1" disabled>
          <UserCheck className={iconCls} /> <span className="truncate">Connected</span>
        </Button>
      );
    }
    if (conn === "pending") {
      return (
        <Button
          variant="secondary"
          size={size}
          className="min-w-0 flex-1"
          onClick={handleConnect}
          disabled={connPending}
          aria-label="Cancel connection request"
        >
          <Clock className={iconCls} /> <span className="truncate">Pending</span>
        </Button>
      );
    }
    return (
      <Button
        variant="secondary"
        size={size}
        className="min-w-0 flex-1"
        onClick={handleConnect}
        disabled={connPending}
      >
        <Link2 className={iconCls} /> <span className="truncate">Connect</span>
      </Button>
    );
  };

  const reasonChip = reason ? (
    <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-saffron/10 px-2 py-0.5 text-[11px] font-medium text-saffron-dk">
      <Sparkles className="size-3 shrink-0" />
      <span className="truncate">{reason}</span>
    </span>
  ) : null;

  if (variant === "row") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/u/${person.handle}`} className="shrink-0">
            <Avatar name={person.name} src={person.avatar_url ?? undefined} size="sm" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/u/${person.handle}`} className="block min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
              <p className="truncate text-xs text-ash">@{person.handle}</p>
              {(person.branch || person.college) && (
                <p className="truncate text-xs text-ash">
                  {[person.branch, person.college].filter(Boolean).join(" . ")}
                </p>
              )}
            </Link>
            {reasonChip}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          {/* Message collapses to an icon-only button on narrow widths so all
              three actions fit, LinkedIn-style. */}
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={handleMessage}
            disabled={msgPending}
            aria-label="Message"
          >
            <MessageSquare className="size-3.5 shrink-0" />
          </Button>
          {followBtn("sm", "size-3.5 shrink-0")}
          {connectBtn("sm", "size-3.5 shrink-0")}
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
          <Avatar name={person.name} src={person.avatar_url ?? undefined} size="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${person.handle}`} className="block min-w-0">
            <p className="truncate text-base font-semibold text-ink transition-colors group-hover:text-saffron">
              {person.name}
            </p>
            <p className="truncate text-xs text-ash">@{person.handle}</p>
            {(person.branch || person.college) && (
              <p className="mt-1 line-clamp-2 text-sm text-ash">
                {[person.branch, person.college].filter(Boolean).join(" . ")}
              </p>
            )}
          </Link>
          {reasonChip}
        </div>
      </div>
      <div className="mt-4 flex gap-2 pt-1 sm:mt-auto">
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={handleMessage}
          disabled={msgPending}
          aria-label="Message"
        >
          <MessageSquare className="size-4 shrink-0" />
        </Button>
        {followBtn("sm", "size-4 shrink-0")}
        {connectBtn("sm", "size-4 shrink-0")}
      </div>
    </article>
  );
}
