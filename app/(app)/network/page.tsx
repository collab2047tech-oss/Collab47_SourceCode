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
          <div className="mt-4 flex flex-col items-start justify-between gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
            <h1 className="font-serif text-4xl text-ink wrap-break-word sm:text-5xl">
              {connections.length} people{" "}
              <span className="italic text-saffron">in your orbit.</span>
            </h1>
            <div className="flex w-full gap-3 sm:w-auto">
              {/* Invite - copies the app origin as an invite link */}
              <ShareButton path="/" label="Invite" className="flex-1 justify-center sm:flex-none border-bone bg-paper text-ink" />

              {/* Find from college - jumps to the college-affinity Suggested
                  section (real data) or Explore when there is nothing to show. */}
              <Link
                href={findFromCollegeHref}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-saffron px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-saffron/90 active:scale-95 sm:flex-none"
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
          <div className="mb-6 flex items-center gap-2 border-b border-bone pb-3">
            <p className="text-caption">
              {profile?.college
                ? `Suggested from ${profile.college}`
                : "Suggested from your cluster"}
            </p>
            {suggested.length > 0 ? (
              <span className="rounded-full bg-bone px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-ash">
                {suggested.length}
              </span>
            ) : null}
          </div>
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
