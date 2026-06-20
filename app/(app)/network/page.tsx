import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { PersonCard } from "@/components/composite/PersonCard";
import { NetworkTabs } from "@/components/composite/NetworkTabs";
import {
  getMyConnections,
  getPendingConnections,
  getSuggestedConnections,
  getRelationshipStates,
} from "@/lib/db/social";
import { getMyProfile } from "@/lib/db/profiles";
import { ShareButton } from "@/components/composite/ShareButton";
import { ConnectionRequests } from "@/components/composite/ConnectionRequests";

export default async function NetworkPage() {
  const [connections, followers, following, pendingSplit, suggested, profile] =
    await Promise.all([
      getMyConnections("all"),
      getMyConnections("followers"),
      getMyConnections("following"),
      getPendingConnections(),
      getSuggestedConnections(8),
      getMyProfile(),
    ]);

  const { incoming, outgoing } = pendingSplit;

  // Real follow/connection state for everyone shown in the Followers/Following
  // tabs, so their buttons read "Following"/"Connected" instead of "Follow".
  const relIds = Array.from(
    new Set([...followers, ...following].map((p) => p.id))
  );
  const relStates = await getRelationshipStates(relIds);

  // "Find from college" jumps to the Suggested section, which is already
  // college-affinity filtered (getSuggestedConnections), when the viewer has a
  // college set; otherwise it routes to the global Explore search.
  const hasSuggested = suggested.length > 0;
  const findFromCollegeHref =
    profile?.college && hasSuggested ? "#suggested-cluster" : "/explore";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <Reveal>
        <div className="rule-top">
          <p className="text-caption">Your Network</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-serif text-5xl text-ink">
              {connections.length} people{" "}
              <span className="italic text-saffron">in your orbit.</span>
            </h1>
            <div className="flex gap-3">
              {/* Invite - copies the app origin as an invite link */}
              <ShareButton path="/" label="Invite" className="border-bone bg-paper text-ink" />

              {/* Find from college - jumps to the college-affinity Suggested
                  section (real data) or Explore when there is nothing to show. */}
              <Link
                href={findFromCollegeHref}
                className="inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-saffron/90 active:scale-95"
              >
                Find from college
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Incoming invitations — Accept / Reject */}
      {incoming.length > 0 ? (
        <Reveal delay={0.04}>
          <div className="mt-12">
            <p className="text-caption mb-4">
              Invitations <span className="text-saffron">({incoming.length})</span>
            </p>
            <ConnectionRequests requests={incoming} />
          </div>
        </Reveal>
      ) : null}

      {/* Tabs + Grid (client island) */}
      <Reveal delay={0.05}>
        <NetworkTabs
          connections={connections}
          followers={followers}
          following={following}
          pending={outgoing}
          relStates={relStates}
        />
      </Reveal>

      {/* Suggested */}
      <Reveal delay={0.1}>
        <div id="suggested-cluster" className="mt-20 scroll-mt-24">
          <p className="text-caption mb-6">
            {profile?.college
              ? `Suggested from ${profile.college}`
              : "Suggested from your cluster"}
          </p>
          {suggested.length === 0 ? (
            <p className="rounded-lg border border-dashed border-bone bg-paper/60 py-10 text-center text-sm text-ash">
              No new suggestions right now. Check back as more people join.
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {suggested.map((person) => (
                <div key={`s-${person.id}`} className="w-64 shrink-0">
                  <PersonCard person={person} variant="grid" state={{}} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
