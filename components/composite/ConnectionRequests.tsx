"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Check, X } from "lucide-react";
import type { MiniProfile } from "@/lib/db/social";
import {
  acceptConnectionAction,
  cancelConnectionAction,
} from "@/app/(app)/network/actions";

interface Props {
  requests: MiniProfile[];
}

export function ConnectionRequests({ requests }: Props) {
  // resolved maps person.id -> "accepted" | "rejected" so the card animates out.
  const [resolved, setResolved] = useState<Record<string, "accepted" | "rejected">>({});
  const [, startTransition] = useTransition();
  // Per-row in-flight set so acting on one request never disables the others.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  // Per-row error so a failed accept/ignore explains itself instead of the card
  // silently re-appearing (read as a UI glitch).
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setBusyFor(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearResolved(id: string) {
    setResolved((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  function setErrorFor(id: string, message: string | null) {
    setErrors((p) => {
      const n = { ...p };
      if (message) n[id] = message;
      else delete n[id];
      return n;
    });
  }

  function accept(person: MiniProfile) {
    // Optimistic: animate the card out instantly, confirm in the background.
    setErrorFor(person.id, null);
    setResolved((p) => ({ ...p, [person.id]: "accepted" }));
    setBusyFor(person.id, true);
    startTransition(async () => {
      const res = await acceptConnectionAction(person.id);
      if (!res.ok) {
        clearResolved(person.id); // rollback - restore the row
        setErrorFor(person.id, res.error || "Could not accept. Try again.");
      }
      setBusyFor(person.id, false);
    });
  }

  function reject(person: MiniProfile) {
    setErrorFor(person.id, null);
    setResolved((p) => ({ ...p, [person.id]: "rejected" }));
    setBusyFor(person.id, true);
    startTransition(async () => {
      const res = await cancelConnectionAction(person.id);
      if (!res.ok) {
        clearResolved(person.id); // rollback - restore the row
        setErrorFor(person.id, res.error || "Could not ignore. Try again.");
      }
      setBusyFor(person.id, false);
    });
  }

  const visible = requests.filter((r) => !resolved[r.id]);

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-bone bg-paper py-6 text-center text-sm text-ink/70">
        No pending invitations.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {visible.map((person) => {
        const isBusy = busy.has(person.id);
        return (
          <li
            key={person.id}
            className="flex flex-col gap-3 rounded-lg border border-bone bg-paper px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm lg:flex-row lg:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Link href={`/u/${person.handle}`} className="shrink-0">
                <Avatar name={person.name} src={person.avatar_url ?? undefined} size="md" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${person.handle}`} className="block min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
                  <p className="truncate text-xs text-ash">@{person.handle}</p>
                </Link>
                {(person.branch || person.college) && (
                  <p className="truncate text-xs text-ash">
                    {[person.branch, person.college].filter(Boolean).join(" . ")}
                  </p>
                )}
                {errors[person.id] ? (
                  <p role="alert" className="mt-1 text-[11px] text-ember">
                    {errors[person.id]}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 lg:ml-auto">
              <Button
                size="sm"
                className="flex-1 lg:flex-none"
                onClick={() => accept(person)}
                disabled={isBusy}
                aria-label={`Accept ${person.name}'s request`}
              >
                <Check className="size-3.5 shrink-0" /> Accept
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 lg:flex-none"
                onClick={() => reject(person)}
                disabled={isBusy}
                aria-label={`Ignore ${person.name}'s request`}
              >
                <X className="size-3.5 shrink-0" /> Ignore
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
