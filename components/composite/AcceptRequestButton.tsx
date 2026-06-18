"use client";

import { useTransition } from "react";
import { acceptRequestAction } from "@/app/(app)/messages/actions";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

interface AcceptRequestButtonProps {
  conversationId: string;
}

export function AcceptRequestButton({ conversationId }: AcceptRequestButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      await acceptRequestAction(conversationId);
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
