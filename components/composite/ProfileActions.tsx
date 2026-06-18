"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/Button";
import { UserCheck, UserPlus, MessageSquare } from "lucide-react";
import {
  followUserAction,
  unfollowUserAction,
} from "@/app/(app)/network/actions";
import { startConversationAction } from "@/app/(app)/messages/actions";

interface ProfileActionsProps {
  handle: string;
  targetUserId?: string;
  initialState?: { isFollowing?: boolean };
}

export function ProfileActions({
  handle,
  targetUserId,
  initialState = {},
}: ProfileActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useState(
    initialState.isFollowing ?? false
  );

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
    <div className="flex gap-3">
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
    </div>
  );
}
