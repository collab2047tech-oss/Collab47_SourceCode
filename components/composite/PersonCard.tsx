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
  Check,
  X,
} from "lucide-react";
import type { MiniProfile, ConnectionDirection } from "@/lib/db/social";
import {
  followUserAction,
  unfollowUserAction,
  requestConnectionAction,
  cancelConnectionAction,
  acceptConnectionAction,
} from "@/app/(app)/network/actions";
import { startConversationAction } from "@/app/(app)/messages/actions";

export interface PersonCardState {
  isFollowing?: boolean;
  /**
   * Directional connection state. This is the fix for the invite-destroying bug:
   * an INCOMING request renders Accept/Ignore, never a cancelable "Pending".
   * Falls back to "none" when omitted.
   */
  direction?: ConnectionDirection;
}

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
  const [direction, setDirection] = useState<ConnectionDirection>(
    state.direction ?? "none"
  );
  // Two-step confirm so clicking "Pending" NEVER instantly destroys an outgoing
  // request - the second click withdraws it (LinkedIn-style).
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFollow() {
    const next = !optimisticFollowing;
    setError(null);
    setOptimisticFollowing(next);
    startFollow(async () => {
      const res = next
        ? await followUserAction(person.id)
        : await unfollowUserAction(person.id);
      if (!res.ok) {
        setOptimisticFollowing(!next); // rollback
        setError(res.error || "Could not update. Try again.");
      }
    });
  }

  function handleConnect() {
    // none -> outgoing_pending
    setError(null);
    setDirection("outgoing_pending");
    startConn(async () => {
      const res = await requestConnectionAction(person.id);
      if (!res.ok) {
        setDirection("none"); // rollback
        setError(res.error || "Could not send request. Try again.");
      }
    });
  }

  function handleWithdraw() {
    // Second click on an outgoing "Pending" - genuinely withdraw it.
    setConfirmWithdraw(false);
    setError(null);
    setDirection("none");
    startConn(async () => {
      const res = await cancelConnectionAction(person.id);
      if (!res.ok) {
        setDirection("outgoing_pending"); // rollback
        setError(res.error || "Could not withdraw. Try again.");
      }
    });
  }

  function handleAccept() {
    // Accept an INCOMING request. This is the operation the old code destroyed.
    setError(null);
    setDirection("connected");
    startConn(async () => {
      const res = await acceptConnectionAction(person.id);
      if (!res.ok) {
        setDirection("incoming_pending"); // rollback
        setError(res.error || "Could not accept. Try again.");
      }
    });
  }

  function handleIgnore() {
    // Ignore an INCOMING request - deletes THEIR request to you (correct here).
    setError(null);
    setDirection("none");
    startConn(async () => {
      const res = await cancelConnectionAction(person.id);
      if (!res.ok) {
        setDirection("incoming_pending"); // rollback
        setError(res.error || "Could not ignore. Try again.");
      }
    });
  }

  function handleMessage() {
    setError(null);
    startMsgTransition(async () => {
      const res = await startConversationAction(person.id);
      if (res.ok && res.conversationId) {
        router.push(`/messages/${res.conversationId}`);
      } else {
        router.push(`/u/${person.handle}`);
      }
    });
  }

  const followBtn = (iconCls: string) => (
    <Button
      variant={optimisticFollowing ? "secondary" : "primary"}
      size="sm"
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

  const messageBtn = (iconCls: string, grow = false) => (
    <Button
      variant="secondary"
      size="sm"
      className={grow ? "min-w-0 flex-1" : "shrink-0"}
      onClick={handleMessage}
      disabled={msgPending}
      aria-label="Message"
    >
      <MessageSquare className={iconCls} />
      {grow ? <span className="truncate">Message</span> : null}
    </Button>
  );

  // The connection slot renders the correct LinkedIn state for each direction.
  const connectSlot = (iconCls: string) => {
    if (direction === "connected") {
      return (
        <Button variant="secondary" size="sm" className="min-w-0 flex-1" disabled>
          <UserCheck className={iconCls} /> <span className="truncate">Connected</span>
        </Button>
      );
    }
    if (direction === "outgoing_pending") {
      if (confirmWithdraw) {
        return (
          <Button
            variant="secondary"
            size="sm"
            className="min-w-0 flex-1 border-ember/50! text-ember! hover:bg-ember! hover:text-cream!"
            onClick={handleWithdraw}
            onBlur={() => setConfirmWithdraw(false)}
            disabled={connPending}
            aria-label={`Withdraw connection request to ${person.name}`}
          >
            <X className={iconCls} /> <span className="truncate">Withdraw?</span>
          </Button>
        );
      }
      return (
        <Button
          variant="secondary"
          size="sm"
          className="min-w-0 flex-1"
          onClick={() => setConfirmWithdraw(true)}
          disabled={connPending}
          aria-label={`Connection request to ${person.name} is pending. Click to withdraw`}
        >
          <Clock className={iconCls} /> <span className="truncate">Pending</span>
        </Button>
      );
    }
    // none
    return (
      <Button
        variant="secondary"
        size="sm"
        className="min-w-0 flex-1"
        onClick={handleConnect}
        disabled={connPending}
      >
        <Link2 className={iconCls} /> <span className="truncate">Connect</span>
      </Button>
    );
  };

  // Incoming invitation gets its own Accept / Ignore pair - responding to the
  // invite is the primary job of the card in this state.
  const incomingActions = (iconCls: string) => (
    <>
      <Button
        size="sm"
        className="min-w-0 flex-1"
        onClick={handleAccept}
        disabled={connPending}
        aria-label={`Accept ${person.name}'s connection request`}
      >
        <Check className={iconCls} /> <span className="truncate">Accept</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="min-w-0 flex-1"
        onClick={handleIgnore}
        disabled={connPending}
        aria-label={`Ignore ${person.name}'s connection request`}
      >
        <X className={iconCls} /> <span className="truncate">Ignore</span>
      </Button>
    </>
  );

  const reasonChip = reason ? (
    <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-saffron/10 px-2 py-0.5 text-[11px] font-medium text-saffron-dk">
      <Sparkles className="size-3 shrink-0" />
      <span className="truncate">{reason}</span>
    </span>
  ) : null;

  const errorLine = error ? (
    <p role="alert" className="mt-2 text-[11px] text-ember">
      {error}
    </p>
  ) : null;

  const meta =
    (person.branch || person.college) && (
      <p className="truncate text-xs text-ash">
        {[person.branch, person.college].filter(Boolean).join(" . ")}
      </p>
    );

  if (variant === "row") {
    const iconCls = "size-3.5 shrink-0";
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
              {meta}
            </Link>
            {reasonChip}
            {errorLine}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          {direction === "incoming_pending" ? (
            incomingActions(iconCls)
          ) : direction === "connected" ? (
            <>{messageBtn(iconCls, true)}{connectSlot(iconCls)}</>
          ) : (
            <>
              {messageBtn(iconCls)}
              {followBtn(iconCls)}
              {connectSlot(iconCls)}
            </>
          )}
        </div>
      </div>
    );
  }

  // grid variant
  const iconCls = "size-4 shrink-0";
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
        {direction === "incoming_pending" ? (
          incomingActions(iconCls)
        ) : direction === "connected" ? (
          <>{messageBtn(iconCls, true)}{connectSlot(iconCls)}</>
        ) : (
          <>
            {messageBtn(iconCls)}
            {followBtn(iconCls)}
            {connectSlot(iconCls)}
          </>
        )}
      </div>
      {errorLine}
    </article>
  );
}
