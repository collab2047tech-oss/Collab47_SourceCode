"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/Button";
import { UserCheck, UserPlus, MessageSquare, Link2, Clock } from "lucide-react";
import {
  followUserAction,
  unfollowUserAction,
  requestConnectionAction,
  cancelConnectionAction,
} from "@/app/(app)/network/actions";
import { startConversationAction } from "@/app/(app)/messages/actions";

type ConnectionStatus = "none" | "pending" | "connected";

interface ProfileActionsProps {
  handle: string;
  targetUserId?: string;
  initialState?: { isFollowing?: boolean };
  initialConnection?: ConnectionStatus;
}

export function ProfileActions({
  handle,
  targetUserId,
  initialState = {},
  initialConnection = "none",
}: ProfileActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useState(
    initialState.isFollowing ?? false
  );
  const [connection, setConnection] =
    useState<ConnectionStatus>(initialConnection);

  const mock = !targetUserId;

  function handleFollow() {
    if (mock) return;
    const next = !isFollowing;
    setIsFollowing(next);
    startTransition(async () => {
      if (next) {
        await followUserAction(targetUserId!);
      } else {
        await unfollowUserAction(targetUserId!);
      }
    });
  }

  function handleConnect() {
    if (mock) return;
    // Already accepted connections are terminal here (no action on click).
    if (connection === "connected") return;

    if (connection === "pending") {
      // Cancel the pending request.
      setConnection("none");
      startTransition(async () => {
        const res = await cancelConnectionAction(targetUserId!);
        if (!res.ok) setConnection("pending");
      });
      return;
    }

    // none -> send a request (optimistically show pending).
    setConnection("pending");
    startTransition(async () => {
      const res = await requestConnectionAction(targetUserId!);
      if (!res.ok) setConnection("none");
    });
  }

  function handleMessage() {
    if (mock) return;
    startTransition(async () => {
      const res = await startConversationAction(targetUserId!);
      if (res.ok && res.conversationId) {
        router.push(`/messages/${res.conversationId}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        size="md"
        onClick={handleMessage}
        disabled={isPending || mock}
        className={mock ? "opacity-60 cursor-not-allowed" : ""}
      >
        <MessageSquare className="size-4" /> Message
      </Button>
      <Button
        variant={isFollowing ? "secondary" : "primary"}
        size="md"
        onClick={handleFollow}
        disabled={isPending || mock}
        className={mock ? "opacity-60 cursor-not-allowed" : ""}
      >
        {isFollowing ? (
          <>
            <UserCheck className="size-4" /> Following
          </>
        ) : (
          <>
            <UserPlus className="size-4" /> Follow
          </>
        )}
      </Button>
      <Button
        variant={connection === "none" ? "primary" : "secondary"}
        size="md"
        onClick={handleConnect}
        disabled={isPending || mock || connection === "connected"}
        className={mock ? "opacity-60 cursor-not-allowed" : ""}
      >
        {connection === "connected" ? (
          <>
            <UserCheck className="size-4" /> Connected
          </>
        ) : connection === "pending" ? (
          <>
            <Clock className="size-4" /> Pending
          </>
        ) : (
          <>
            <Link2 className="size-4" /> Connect
          </>
        )}
      </Button>
    </div>
  );
}
