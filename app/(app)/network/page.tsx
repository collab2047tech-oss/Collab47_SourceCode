import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { PersonCard } from "@/components/composite/PersonCard";
import { NetworkTabs } from "@/components/composite/NetworkTabs";
import {
  getMyConnections,
  getPendingConnections,
  getSuggestedPeople,
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
      getSuggestedPeople(8),
      getMyProfile(),
    ]);

  const { incoming, outgoing } = pendingSplit;

  // Real follow/connection state for everyone shown in the Followers/Following
  // tabs AND the Suggested section, so every card's buttons read the correct
  // state ("Following" / "Connected" / "Pending") instead of always "Follow".
  const relIds = Array.from(
    new Set([...followers, ...following, ...suggested].map((p) => p.id))
  );
  const relStates = await getRelationshipStates(relIds);

  // Split the mixed suggestion pool into TWO honest clusters so the section
  // label can never over-claim: people who are genuinely from the viewer's
  // college (truthful "Same college" reason) vs everyone else. Previously the
  // whole row was labelled by suggested[0]'s reason, so a single college match
  // mislabelled branch-mates / 2nd-degree people from OTHER colleges as "from
  // your college" - exactly the reported bug.
  const collegeMatches = profile?.college
    ? suggested.filter((p) => p.reason === "Same college")
    : [];
  const collegeMatchIds = new Set(collegeMatches.map((p) => p.id));
  const otherSuggestions = suggested.filter((p) => !collegeMatchIds.has(p.id));

  // "Find from college" only points at a real college cluster; otherwise Explore.
  const findFromCollegeHref =
    collegeMatches.length > 0 ? "#college-cluster" : "/explore";

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
              {/* Invite - copies a real invite link (the app origin) to share. */}
              <ShareButton
                path="/"
                label="Invite link"
                shareTitle="Join me on Collab47"
                shareText="Come build and collaborate with me on Collab47."
                className="flex-1 justify-center sm:flex-none"
              />

              {/* Find from college - jumps to the college-ranked Suggested
                  section (real data) or Explore when there is nothing to show. */}
              <Link
                href={findFromCollegeHref}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-saffron px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-95 sm:flex-none"
              >
                Find from college
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Incoming invitations - Accept / Reject */}
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

      {/* Suggested - from your college (only true same-college matches) */}
      {collegeMatches.length > 0 ? (
        <Reveal delay={0.1}>
          <div id="college-cluster" className="mt-20 scroll-mt-24">
            <div className="mb-6 flex items-center gap-2 border-b border-bone pb-3">
              <p className="text-caption">Suggested from {profile?.college}</p>
              <span className="rounded-full bg-bone px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-ink/70">
                {collegeMatches.length}
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {collegeMatches.map((person) => (
                <div key={`c-${person.id}`} className="w-72 shrink-0">
                  <PersonCard
                    person={person}
                    variant="grid"
                    state={relStates[person.id] ?? {}}
                    reason={person.reason}
                  />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      ) : null}

      {/* People you may know - everyone else (branch, 2nd-degree, shared field) */}
      <Reveal delay={0.12}>
        <div id="suggested-cluster" className="mt-20 scroll-mt-24">
          <div className="mb-6 flex items-center gap-2 border-b border-bone pb-3">
            <p className="text-caption">People you may know</p>
            {otherSuggestions.length > 0 ? (
              <span className="rounded-full bg-bone px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-ink/70">
                {otherSuggestions.length}
              </span>
            ) : null}
          </div>
          {otherSuggestions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-bone bg-paper py-10 text-center text-sm text-ink/70">
              No new suggestions right now. Check back as more people join.
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {otherSuggestions.map((person) => (
                <div key={`s-${person.id}`} className="w-72 shrink-0">
                  <PersonCard
                    person={person}
                    variant="grid"
                    state={relStates[person.id] ?? {}}
                    reason={person.reason}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
