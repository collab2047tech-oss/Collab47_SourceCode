"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { PersonCard, type PersonCardState } from "@/components/composite/PersonCard";
import type { MiniProfile, RelationshipState } from "@/lib/db/social";

type TabId = "connections" | "followers" | "following" | "pending";

interface NetworkTabsProps {
  connections: MiniProfile[];
  followers: MiniProfile[];
  following: MiniProfile[];
  pending: MiniProfile[];
  /** Real follow/connection state keyed by person id (for Followers/Following). */
  relStates?: Record<string, RelationshipState>;
}

export function NetworkTabs({
  connections,
  followers,
  following,
  pending,
  relStates = {},
}: NetworkTabsProps) {
  const [tab, setTab] = useState<TabId>("connections");

  const tabs: { id: TabId; label: string; data: MiniProfile[] }[] = [
    { id: "connections", label: "Connections", data: connections },
    { id: "followers", label: "Followers", data: followers },
    { id: "following", label: "Following", data: following },
    { id: "pending", label: "Pending sent", data: pending },
  ];

  const activeData = tabs.find((t) => t.id === tab)?.data ?? [];

  function stateFor(personId: string): PersonCardState {
    if (tab === "pending") return { pending: true };
    // Connections tab lists accepted connections by definition.
    if (tab === "connections") return { isConnected: true };
    // Followers / Following: reflect the viewer's real relationship so buttons
    // read "Connected" / "Following" instead of "Follow".
    const rel = relStates[personId];
    if (!rel) return tab === "following" ? { isFollowing: true } : {};
    return {
      isFollowing: rel.isFollowing,
      isConnected: rel.isConnected,
      pending: rel.pending,
    };
  }

  return (
    <>
      {/* Tab bar */}
      <div className="mt-12 flex items-center gap-1 border-b border-bone">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm transition-colors",
              tab === t.id
                ? "border-b-2 border-saffron text-ink"
                : "text-ash hover:text-ink"
            )}
          >
            {t.label}
            <span className="tabular-nums text-xs text-ash">{t.data.length}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeData.length === 0 ? (
          <p className="col-span-full py-10 text-center text-ash">
            Nothing here yet.
          </p>
        ) : (
          activeData.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              variant="grid"
              state={stateFor(person.id)}
            />
          ))
        )}
      </div>
    </>
  );
}
