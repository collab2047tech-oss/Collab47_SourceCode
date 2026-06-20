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
  const [isPending, startTransition] = useTransition();

  function accept(person: MiniProfile) {
    setResolved((p) => ({ ...p, [person.id]: "accepted" }));
    startTransition(async () => {
      const res = await acceptConnectionAction(person.id);
      if (!res.ok) setResolved((p) => { const n = { ...p }; delete n[person.id]; return n; });
    });
  }

  function reject(person: MiniProfile) {
    setResolved((p) => ({ ...p, [person.id]: "rejected" }));
    startTransition(async () => {
      const res = await cancelConnectionAction(person.id);
      if (!res.ok) setResolved((p) => { const n = { ...p }; delete n[person.id]; return n; });
    });
  }

  const visible = requests.filter((r) => !resolved[r.id]);

  if (visible.length === 0) {
    return <p className="py-6 text-center text-ash">No pending invitations.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {visible.map((person) => (
        <li
          key={person.id}
          className="flex flex-col gap-3 rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm lg:flex-row lg:items-center"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/u/${person.handle}`} className="shrink-0">
              <Avatar name={person.name} src={person.avatar_url ?? undefined} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/u/${person.handle}`} className="block">
                <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
                <p className="truncate text-xs text-ash">@{person.handle}</p>
              </Link>
              {(person.branch || person.college) && (
                <p className="truncate text-xs text-ash">
                  {[person.branch, person.college].filter(Boolean).join(" . ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Button size="sm" className="flex-1 lg:flex-none" onClick={() => accept(person)} disabled={isPending}>
              <Check className="size-3.5 shrink-0" /> Accept
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 lg:flex-none"
              onClick={() => reject(person)}
              disabled={isPending}
              aria-label="Ignore request"
            >
              <X className="size-3.5 shrink-0" /> Ignore
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
