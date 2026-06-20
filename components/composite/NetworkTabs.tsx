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
      <div className="mt-12 overflow-x-auto border-b border-bone no-scrollbar">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-3 text-sm transition-colors sm:px-5",
                tab === t.id
                  ? "border-b-2 border-saffron text-ink"
                  : "text-ash hover:text-ink"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none transition-colors",
                  tab === t.id ? "bg-saffron/10 text-saffron-dk" : "bg-bone text-ash"
                )}
              >
                {t.data.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {activeData.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-bone bg-paper/60 py-12 text-center text-sm text-ash">
          Nothing here yet.
        </p>
      ) : (
        <div
          key={tab}
          className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {activeData.map((person, i) => (
            <div key={person.id} className="h-full" style={{ "--stagger-i": i } as React.CSSProperties}>
              <PersonCard
                person={person}
                variant="grid"
                state={stateFor(person.id)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
