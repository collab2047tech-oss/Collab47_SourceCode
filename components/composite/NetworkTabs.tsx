"use client";

import { useMemo, useState } from "react";
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

  // Ids the viewer follows; lets the Followers tab show "Following" for people
  // the viewer already follows back, even when relStates lacks an entry.
  const followingIds = useMemo(
    () => new Set(following.map((p) => p.id)),
    [following]
  );

  const tabs: { id: TabId; label: string; data: MiniProfile[] }[] = [
    { id: "connections", label: "Connections", data: connections },
    { id: "followers", label: "Followers", data: followers },
    { id: "following", label: "Following", data: following },
    { id: "pending", label: "Pending sent", data: pending },
  ];

  const activeData = tabs.find((t) => t.id === tab)?.data ?? [];

  const emptyCopy: Record<TabId, string> = {
    connections: "No connections yet. Connect with people from your college below.",
    followers: "No followers yet. Share your profile to grow your network.",
    following: "You are not following anyone yet. See people you may know below.",
    pending: "No requests waiting. Connect with someone to get started.",
  };

  function stateFor(personId: string): PersonCardState {
    // "Pending sent" tab lists the viewer's OWN outgoing requests by definition.
    if (tab === "pending") return { direction: "outgoing_pending" };
    // Connections tab lists accepted connections by definition.
    if (tab === "connections") return { direction: "connected" };
    // Followers / Following: reflect the viewer's real, DIRECTIONAL relationship
    // so an incoming request never renders as a cancelable "Pending".
    const rel = relStates[personId];
    if (!rel) {
      // Following tab: a listed person is followed by definition.
      if (tab === "following") return { isFollowing: true };
      // Followers tab: only show "Following" if the viewer follows them back.
      return followingIds.has(personId) ? { isFollowing: true } : {};
    }
    return {
      isFollowing: rel.isFollowing,
      direction: rel.direction,
    };
  }

  return (
    <>
      {/* Manage my network - LinkedIn grammar: a labelled row of count tabs. */}
      <p className="text-caption mt-16 mb-4">Manage my network</p>

      {/* Tab bar */}
      <div className="overflow-x-auto border-b border-bone no-scrollbar">
        <div role="tablist" aria-label="Manage my network" className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`network-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="network-tabpanel"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-inset sm:px-5",
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
      <div id="network-tabpanel" role="tabpanel" aria-labelledby={`network-tab-${tab}`}>
        {activeData.length === 0 ? (
          <p className="mt-10 rounded-lg border border-dashed border-bone bg-paper py-12 text-center text-sm text-ink/70">
            {emptyCopy[tab]}
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
      </div>
    </>
  );
}
