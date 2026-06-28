"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { UserPlus, UserCheck } from "lucide-react";
import {
  followFromExploreAction,
  unfollowFromExploreAction,
} from "@/app/(app)/explore/actions";
import type { SuggestedPerson, RelationshipState } from "@/lib/db/social";

/**
 * Suggested-person card for Explore with a REAL, optimistic Follow. Uses the
 * explore follow actions which do NOT revalidatePath("/explore") - the button
 * flips instantly and the optimistic state stands (no full-tree refetch lag).
 * Renders the ranked `reason` ("Same college", "3 mutual connections", ...).
 */
export function SuggestedPersonCard({
  person,
  state,
}: {
  person: SuggestedPerson;
  state?: RelationshipState;
}) {
  const [isPending, startTransition] = useTransition();
  const [following, setFollowing] = useState(state?.isFollowing ?? false);
  const connected = state?.isConnected ?? false;

  function toggleFollow() {
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const res = next
        ? await followFromExploreAction(person.id)
        : await unfollowFromExploreAction(person.id);
      if (!res.ok) setFollowing(!next); // roll back on error
    });
  }

  return (
    <article className="flex h-full flex-col rounded-lg border border-bone bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-saffron/40 hover:shadow-sm">
      <Link href={`/u/${person.handle}`} className="flex items-start gap-3">
        <Avatar name={person.name} src={person.avatar_url ?? undefined} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
          <p className="truncate text-xs text-ash">@{person.handle}</p>
        </div>
      </Link>

      <p className="mt-3 truncate text-xs font-medium text-saffron-dk">{person.reason}</p>
      {(person.branch || person.college) && (
        <p className="mt-0.5 truncate text-xs text-ash">
          {[person.branch, person.college].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="mt-4 pt-1 sm:mt-auto">
        {connected ? (
          <Button variant="secondary" size="sm" className="w-full" disabled>
            <UserCheck className="size-4 shrink-0" /> Connected
          </Button>
        ) : (
          <Button
            variant={following ? "secondary" : "primary"}
            size="sm"
            className="w-full"
            onClick={toggleFollow}
            disabled={isPending}
          >
            {following ? (
              <>
                <UserCheck className="size-4 shrink-0" /> Following
              </>
            ) : (
              <>
                <UserPlus className="size-4 shrink-0" /> Follow
              </>
            )}
          </Button>
        )}
      </div>
    </article>
  );
}
