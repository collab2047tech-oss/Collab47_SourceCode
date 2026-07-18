import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { PersonCard } from "@/components/composite/PersonCard";
import { NetworkTabs } from "@/components/composite/NetworkTabs";
import {
  getMyConnections,
  getPendingConnections,
  getSuggestedPeople,
  getRelationshipStates,
  type MiniProfile,
  type PendingConnections,
  type SuggestedPerson,
  type RelationshipState,
} from "@/lib/db/social";
import { getMyProfile } from "@/lib/db/profiles";
import { ShareButton } from "@/components/composite/ShareButton";
import { ConnectionRequests } from "@/components/composite/ConnectionRequests";

export default async function NetworkPage() {
  // Degrade gracefully: one failing fetch must not blank the whole page to the
  // route error boundary. Each section defaults to empty on its own failure.
  const [
    connectionsR,
    followersR,
    followingR,
    pendingR,
    suggestedR,
    profileR,
  ] = await Promise.allSettled([
    getMyConnections("all"),
    getMyConnections("followers"),
    getMyConnections("following"),
    getPendingConnections(),
    getSuggestedPeople(8),
    getMyProfile(),
  ]);

  const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const connections = settled<MiniProfile[]>(connectionsR, []);
  const followers = settled<MiniProfile[]>(followersR, []);
  const following = settled<MiniProfile[]>(followingR, []);
  const pendingSplit = settled<PendingConnections>(pendingR, {
    incoming: [],
    outgoing: [],
  });
  const suggested = settled<SuggestedPerson[]>(suggestedR, []);
  const profile = settled<Awaited<ReturnType<typeof getMyProfile>>>(
    profileR,
    null
  );

  const { incoming, outgoing } = pendingSplit;

  // Real, DIRECTIONAL follow/connection state for everyone in the Manage tabs
  // and the discovery grid, so every card's buttons read the correct state
  // (Following / Connected / Pending / Accept) instead of always "Follow".
  const relIds = Array.from(
    new Set([...followers, ...following, ...suggested].map((p) => p.id))
  );
  const relStates: Record<string, RelationshipState> =
    relIds.length > 0
      ? await getRelationshipStates(relIds).catch(() => ({}))
      : {};

  // Split suggestions into TWO honest clusters so the section label can never
  // over-claim: genuine same-college matches vs everyone else. The "reason"
  // chip on each card is real (from the ranker) - no fabricated mutual counts.
  const collegeMatches = profile?.college
    ? suggested.filter((p) => p.reason === "Same college")
    : [];
  const collegeMatchIds = new Set(collegeMatches.map((p) => p.id));
  const otherSuggestions = suggested.filter((p) => !collegeMatchIds.has(p.id));

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
              {/* Only shown when there is a real same-college cluster to jump to;
                  otherwise it would silently fall back and over-promise. */}
              {collegeMatches.length > 0 ? (
                <Link
                  href="#college-cluster"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-saffron px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-95 sm:flex-none"
                >
                  Find from college
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Invitations FIRST (LinkedIn grammar) - only when non-empty, count in the
          header, Accept/Ignore inline. This is the surface that must never let an
          incoming invite be destroyed. */}
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

      {/* Manage my network - Connections / Followers / Following / Sent tabs. */}
      <Reveal delay={0.05}>
        <NetworkTabs
          connections={connections}
          followers={followers}
          following={following}
          pending={outgoing}
          relStates={relStates}
        />
      </Reveal>

      {/* Discovery: from your college (only true same-college matches). */}
      {collegeMatches.length > 0 ? (
        <Reveal delay={0.1}>
          <div id="college-cluster" className="mt-20 scroll-mt-24">
            <div className="mb-6 flex items-center gap-2 border-b border-bone pb-3">
              <p className="text-caption">Suggested from {profile?.college}</p>
              <span className="rounded-full bg-bone px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-ink/70">
                {collegeMatches.length}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collegeMatches.map((person) => (
                <PersonCard
                  key={`c-${person.id}`}
                  person={person}
                  variant="grid"
                  state={relStates[person.id] ?? {}}
                  reason={person.reason}
                />
              ))}
            </div>
          </div>
        </Reveal>
      ) : null}

      {/* Discovery: people you may know (branch / 2nd-degree / shared field). */}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherSuggestions.map((person) => (
                <PersonCard
                  key={`s-${person.id}`}
                  person={person}
                  variant="grid"
                  state={relStates[person.id] ?? {}}
                  reason={person.reason}
                />
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
