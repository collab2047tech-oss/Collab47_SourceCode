"use client";

import { useState, useTransition } from "react";
import { acceptRequestAction } from "@/app/(app)/messages/actions";
import {
  useMessagesStore,
  type RailConversation,
} from "@/components/messages/MessagesProvider";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

interface AcceptRequestButtonProps {
  conversationId: string;
}

export function AcceptRequestButton({ conversationId }: AcceptRequestButtonProps) {
  const store = useMessagesStore();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    // Snapshot the request row so a failed accept can be fully reversed - the
    // reference pattern DeclineRequestButton uses. Without this, a failed accept
    // silently strands the conversation in the inbox until a hard reload.
    const snapshot: RailConversation | undefined = store?.requests.find(
      (c) => c.id === conversationId
    );
    // Optimistic: move the row from Requests into the inbox instantly.
    store?.moveRequestToInbox(conversationId);
    startTransition(async () => {
      const r = await acceptRequestAction(conversationId);
      if (!r.ok && snapshot) {
        // Rollback: pull it out of the inbox and restore it to Requests.
        store?.removeConversation(conversationId);
        store?.restoreConversation(snapshot);
        setError("Could not accept. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleAccept}
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 rounded-md bg-saffron px-3 py-2 text-xs font-medium text-cream transition-colors hover:bg-saffron-dk",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <Check className="size-3" />
        {isPending ? "Accepting..." : "Accept"}
      </button>
      {error ? (
        <p role="alert" className="text-[11px] text-ember">
          {error}
        </p>
      ) : null}
    </div>
  );
}
