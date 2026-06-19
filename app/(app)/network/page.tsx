import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { PersonCard } from "@/components/composite/PersonCard";
import { NetworkTabs } from "@/components/composite/NetworkTabs";
import { getMyConnections, getSuggestedConnections } from "@/lib/db/social";
import { getMyProfile } from "@/lib/db/profiles";
import { ShareButton } from "@/components/composite/ShareButton";

export default async function NetworkPage() {
  const [connections, followers, following, pending, suggested, profile] =
    await Promise.all([
      getMyConnections("all"),
      getMyConnections("followers"),
      getMyConnections("following"),
      getMyConnections("pending"),
      getSuggestedConnections(8),
      getMyProfile(),
    ]);

  const collegeQuery = profile?.college
    ? `?college=${encodeURIComponent(profile.college)}`
    : "";

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

              {/* Find from college - links to /explore filtered by the viewer's college */}
              <Link
                href={`/explore${collegeQuery}`}
                className="inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-saffron/90 active:scale-95"
              >
                Find from college
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Tabs + Grid (client island) */}
      <Reveal delay={0.05}>
        <NetworkTabs
          connections={connections}
          followers={followers}
          following={following}
          pending={pending}
        />
      </Reveal>

      {/* Suggested */}
      <Reveal delay={0.1}>
        <div className="mt-20">
          <p className="text-caption mb-6">Suggested from your cluster</p>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {suggested.map((person) => (
              <div key={`s-${person.id}`} className="w-64 shrink-0">
                <PersonCard person={person} variant="grid" state={{}} />
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
