"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { declineRequestAction } from "@/app/(app)/messages/actions";
import {
  useMessagesStore,
  type RailConversation,
} from "@/components/messages/MessagesProvider";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

interface DeclineRequestButtonProps {
  conversationId: string;
  /** Where to go after declining (e.g. back to the requests list). */
  redirectTo?: string;
}

export function DeclineRequestButton({
  conversationId,
  redirectTo,
}: DeclineRequestButtonProps) {
  const router = useRouter();
  const store = useMessagesStore();
  const [isPending, startTransition] = useTransition();

  function handleDecline() {
    // Snapshot the row so we can restore it if the server decline fails.
    const snapshot: RailConversation | undefined = store?.requests.find(
      (c) => c.id === conversationId
    );
    // Optimistic: remove the row instantly.
    store?.removeConversation(conversationId);
    startTransition(async () => {
      const r = await declineRequestAction(conversationId);
      if (r.ok) {
        if (redirectTo) router.push(redirectTo);
      } else if (snapshot) {
        store?.restoreConversation(snapshot);
      }
    });
  }

  return (
    <button
      onClick={handleDecline}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-bone px-3 py-2 text-xs font-medium text-ink transition-all hover:bg-bone active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      )}
    >
      <X className="size-3" />
      {isPending ? "Declining..." : "Decline"}
    </button>
  );
}
