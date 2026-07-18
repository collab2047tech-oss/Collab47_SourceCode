import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { Tag } from "@/components/primitives/Tag";
import { ExploreSearch } from "@/components/composite/ExploreSearch";
import { TrendingTags } from "@/components/composite/TrendingTags";
import { SuggestedPersonCard } from "./SuggestedPersonCard";
import { SuggestedProjectCard } from "./SuggestedProjectCard";
import {
  searchAll,
  getSuggestedPeople,
  getSuggestedProjects,
  getTrendingTags,
  getRelationshipStates,
} from "@/lib/db/social";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  TrendingUp,
  Sparkles,
  Trophy,
  Briefcase,
  Hash,
  Compass,
  ArrowRight,
  RotateCw,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getCollegeLeaderboard(limit = 5): Promise<{ name: string; count: number }[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb.rpc("college_leaderboard", { lim: limit });
  return ((data as Array<{ college: string; members: number }> | null) ?? []).map((r) => ({
    name: r.college,
    count: r.members,
  }));
}

/**
 * Editorial section header: a serif index numeral, an uppercase label, and an
 * optional "see all" action. Replaces the old identical p-6 boxes so the surface
 * reads as a composed magazine spread instead of stacked sameness.
 */
function SectionHead({
  index,
  icon,
  children,
  action,
}: {
  index: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-bone pb-3">
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-2xl leading-none text-bone tabular-nums" aria-hidden>
          {index}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-ash">
          {icon} {children}
        </span>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-saffron transition-colors hover:text-saffron-dk"
        >
          {action.label}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  // ---------------------------------------------------------------------------
  // SEARCH MODE: /explore?q= renders ranked results (server-seeded).
  // ---------------------------------------------------------------------------
  if (query) {
    const initialResults = await searchAll(query);
    return (
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <div className="rule-top">
            <p className="text-caption">Search</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-ink sm:text-4xl">
              Results for <span className="italic text-saffron">{query}</span>
            </h1>
          </div>
        </Reveal>
        <div className="mt-8">
          <ExploreSearch initialQuery={query} initialResults={initialResults} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // DISCOVER MODE: real discovery surface (unchanged queries, rebuilt layout).
  // Error state: the data helpers currently swallow query errors into [], so a
  // thrown error is rare - but wrapping the recall lets a genuine failure render
  // a retry instead of a misleading "nothing here".
  // ---------------------------------------------------------------------------
  let people: Awaited<ReturnType<typeof getSuggestedPeople>>;
  let projects: Awaited<ReturnType<typeof getSuggestedProjects>>;
  let trending: Awaited<ReturnType<typeof getTrendingTags>>;
  let tagCloud: Awaited<ReturnType<typeof getTrendingTags>>;
  let leaderboard: { name: string; count: number }[];
  let relationships: Awaited<ReturnType<typeof getRelationshipStates>>;

  try {
    [people, projects, trending, tagCloud, leaderboard] = await Promise.all([
      getSuggestedPeople(8),
      getSuggestedProjects(4),
      getTrendingTags(6),
      getTrendingTags(24),
      getCollegeLeaderboard(5),
    ]);
    relationships = await getRelationshipStates(people.map((p) => p.id));
  } catch {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rule-top">
          <p className="text-caption">Discover</p>
          <h1 className="mt-4 font-serif text-3xl leading-tight text-ink sm:text-4xl">
            Discovery is catching its breath.
          </h1>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-bone bg-paper/50 py-16 text-center">
          <p className="max-w-sm text-body-sm text-ash">
            We couldn&rsquo;t load the discovery feed just now. This is usually momentary.
          </p>
          <Link
            href="/explore"
            prefetch={false}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-all hover:bg-saffron active:scale-95"
          >
            <RotateCw className="size-4" /> Try again
          </Link>
        </div>
      </div>
    );
  }

  const nothingYet =
    people.length === 0 &&
    projects.length === 0 &&
    trending.length === 0 &&
    tagCloud.length === 0 &&
    leaderboard.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Editorial masthead */}
      <Reveal>
        <div className="rule-top">
          <p className="text-caption">Discover</p>
          <h1 className="mt-4 font-serif text-3xl leading-[1.08] text-ink sm:text-5xl md:text-6xl">
            Find work, people, and{" "}
            <span className="italic text-saffron">your next project.</span>
          </h1>
          <p className="mt-5 max-w-xl text-body-lg leading-relaxed text-ash">
            Search the network, follow what is trending, and meet builders from
            every campus in one place.
          </p>
        </div>
      </Reveal>

      <div className="mt-8">
        <ExploreSearch />
      </div>

      {nothingYet ? (
        // Unified empty state (coaching + real CTAs) for a fresh network.
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-bone bg-paper/50 px-6 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-bone bg-paper text-ash">
            <Compass className="size-7" />
          </div>
          <h2 className="mt-5 font-serif text-h2 text-ink">The network is just getting started.</h2>
          <p className="mt-2 max-w-sm text-body-sm text-ash">
            Post the first thing, start a project, or use search to find people you
            already know. Discovery fills in fast once there&rsquo;s a little momentum.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/home"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-all hover:bg-saffron active:scale-95"
            >
              Write a post
            </Link>
            <Link
              href="/collabs/new"
              className="inline-flex items-center gap-2 rounded-full border border-bone px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              Start a project
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ---------------------------------------------------------------
              ROW 1 (asymmetric 8/4): People (hero) + Trending (featured rail).
              --------------------------------------------------------------- */}
          <div className="mt-14 grid gap-8 lg:grid-cols-12">
            <Reveal className="lg:col-span-8">
              <section>
                <SectionHead
                  index="01"
                  icon={<Sparkles className="size-3" />}
                  action={{ href: "/network", label: "See all" }}
                >
                  People to discover
                </SectionHead>
                {people.length > 0 ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {people.map((p) => (
                      <SuggestedPersonCard key={p.id} person={p} state={relationships[p.id]} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-bone bg-paper/50 py-14 text-center">
                    <p className="text-sm text-ash">No suggestions yet.</p>
                    <Link href="/network" className="mt-2 text-sm text-saffron underline underline-offset-2">
                      Browse the network
                    </Link>
                  </div>
                )}
              </section>
            </Reveal>

            <Reveal delay={0.08} className="lg:col-span-4">
              <section className="lg:sticky lg:top-24">
                <SectionHead
                  index="02"
                  icon={<TrendingUp className="size-3" />}
                >
                  Trending now
                </SectionHead>
                <div className="mt-5 rounded-lg border border-bone bg-paper p-5">
                  <TrendingTags tags={trending} variant="card" />
                </div>
              </section>
            </Reveal>
          </div>

          {/* ---------------------------------------------------------------
              ROW 2 (asymmetric 5/7): Leaderboard + Hashtag cloud.
              --------------------------------------------------------------- */}
          <div className="mt-16 grid gap-8 lg:grid-cols-12">
            <Reveal className="lg:col-span-5">
              <section>
                <SectionHead index="03" icon={<Trophy className="size-3" />}>
                  Colleges by members
                </SectionHead>
                {leaderboard.length > 0 ? (
                  <ul className="mt-3 divide-y divide-bone">
                    {leaderboard.map((c, i) => (
                      <li key={c.name} className="flex items-center justify-between gap-3 py-3.5">
                        <div className="flex min-w-0 items-center gap-4">
                          <span
                            className={`w-8 shrink-0 text-center font-serif text-3xl leading-none tabular-nums ${
                              i === 0 ? "text-gold" : i < 3 ? "text-saffron" : "text-ash/60"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-saffron/10 px-3 py-1 text-xs font-semibold tabular-nums text-saffron-dk">
                          <CountUp to={c.count} /> {c.count === 1 ? "member" : "members"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-6 text-sm text-ash">Not enough members yet to rank colleges.</p>
                )}
              </section>
            </Reveal>

            <Reveal delay={0.08} className="lg:col-span-7">
              <section>
                <SectionHead index="04" icon={<Hash className="size-3" />}>
                  Explore hashtags
                </SectionHead>
                {tagCloud.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {tagCloud.map((t) => (
                      <Link
                        key={t.tag}
                        href={`/t/${t.tag}`}
                        className="transition-opacity hover:opacity-80"
                      >
                        <Tag variant={t.forYou ? "saffron" : "outline"}>
                          #{t.tag}
                          <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{t.count}</span>
                        </Tag>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-bone bg-paper/50 py-14 text-center">
                    <p className="text-sm text-ash">No hashtags in circulation yet.</p>
                    <Link href="/home" className="mt-2 text-sm text-saffron underline underline-offset-2">
                      Post one to start a trend
                    </Link>
                  </div>
                )}
              </section>
            </Reveal>
          </div>

          {/* ---------------------------------------------------------------
              ROW 3 (full width): Open projects - the freshest opportunities.
              --------------------------------------------------------------- */}
          <Reveal>
            <section className="mt-16">
              <SectionHead
                index="05"
                icon={<Briefcase className="size-3" />}
                action={{ href: "/collabs", label: "Browse all" }}
              >
                Open projects for you
              </SectionHead>
              {projects.length > 0 ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {projects.map((p) => (
                    <SuggestedProjectCard key={p.id} project={p} />
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-bone bg-paper/50 py-16 text-center">
                  <p className="text-sm text-ash">No open projects yet.</p>
                  <Link
                    href="/collabs/new"
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-all hover:bg-saffron active:scale-95"
                  >
                    Start the first one
                  </Link>
                </div>
              )}
            </section>
          </Reveal>
        </>
      )}
    </div>
  );
}
