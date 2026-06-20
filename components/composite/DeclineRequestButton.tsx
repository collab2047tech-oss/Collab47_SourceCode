"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { declineRequestAction } from "@/app/(app)/messages/actions";
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
  const [isPending, startTransition] = useTransition();

  function handleDecline() {
    startTransition(async () => {
      const r = await declineRequestAction(conversationId);
      if (r.ok && redirectTo) router.push(redirectTo);
    });
  }

  return (
    <button
      onClick={handleDecline}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-bone px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-bone",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <X className="size-3" />
      {isPending ? "Declining..." : "Decline"}
    </button>
  );
}
