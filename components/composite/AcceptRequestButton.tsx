"use client";

import { useTransition } from "react";
import { acceptRequestAction } from "@/app/(app)/messages/actions";
import { useMessagesStore } from "@/components/messages/MessagesProvider";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

interface AcceptRequestButtonProps {
  conversationId: string;
}

export function AcceptRequestButton({ conversationId }: AcceptRequestButtonProps) {
  const store = useMessagesStore();
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    // Optimistic: move the row from Requests into the inbox instantly.
    store?.moveRequestToInbox(conversationId);
    startTransition(async () => {
      const r = await acceptRequestAction(conversationId);
      // The server revalidate re-seeds the provider on the next load; nothing to
      // roll back visibly on the rail since accept rarely fails for a member.
      if (!r.ok) {
        // Best-effort: a failed accept is surfaced by the server state on reload.
      }
    });
  }

  return (
    <button
      onClick={handleAccept}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 rounded-md bg-saffron px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-saffron-dk",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <Check className="size-3" />
      {isPending ? "Accepting..." : "Accept"}
    </button>
  );
}
