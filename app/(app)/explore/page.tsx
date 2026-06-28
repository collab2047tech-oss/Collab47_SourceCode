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
import { TrendingUp, Sparkles, Trophy, Briefcase, Hash } from "lucide-react";

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

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-ash">
      {icon} {children}
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
  // SEARCH MODE: /explore?q= now actually renders ranked results (was dropped).
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
  // DISCOVER MODE: dense, real discovery surface.
  // ---------------------------------------------------------------------------
  const [people, projects, trending, tagCloud, leaderboard] = await Promise.all([
    getSuggestedPeople(8),
    getSuggestedProjects(4),
    getTrendingTags(6),
    getTrendingTags(24),
    getCollegeLeaderboard(5),
  ]);

  const relationships = await getRelationshipStates(people.map((p) => p.id));

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="rule-top">
          <p className="text-caption">Discover</p>
          <h1 className="mt-4 font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
            Find work, people, and{" "}
            <span className="italic text-saffron">your next project.</span>
          </h1>
          <p className="mt-4 max-w-xl text-body-sm text-ash">
            Search the network, follow what is trending, and meet builders from
            every campus in one place.
          </p>
        </div>
      </Reveal>

      <div className="mt-10">
        <ExploreSearch />
      </div>

      {/* People you may know - ranked + actionable Follow */}
      {people.length > 0 ? (
        <Reveal>
          <section className="mt-12">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel icon={<Sparkles className="size-3" />}>People you may know</SectionLabel>
              <Link href="/network" className="text-xs font-medium text-saffron transition-colors hover:text-saffron-dk">
                See all
              </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {people.map((p) => (
                <SuggestedPersonCard key={p.id} person={p} state={relationships[p.id]} />
              ))}
            </div>
          </section>
        </Reveal>
      ) : null}

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {/* Projects for you - matched + real */}
        <Reveal className="lg:col-span-2">
          <section className="card h-full p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel icon={<Briefcase className="size-3" />}>Projects for you</SectionLabel>
              <Link href="/collabs" className="text-xs font-medium text-saffron transition-colors hover:text-saffron-dk">
                Browse all
              </Link>
            </div>
            {projects.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {projects.map((p) => (
                  <SuggestedProjectCard key={p.id} project={p} />
                ))}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-bone bg-paper/50 py-12 text-center">
                <p className="text-sm text-ash">No open projects yet.</p>
                <Link href="/collabs/new" className="mt-2 text-sm text-saffron underline">
                  Start the first one
                </Link>
              </div>
            )}
          </section>
        </Reveal>

        {/* Trending now - one real source of truth */}
        <Reveal delay={0.1}>
          <article className="card h-full p-6">
            <SectionLabel icon={<TrendingUp className="size-3" />}>Trending now</SectionLabel>
            <div className="mt-5">
              <TrendingTags tags={trending} variant="card" />
            </div>
          </article>
        </Reveal>

        {/* Hashtag discovery cloud - sized by real use_count */}
        {tagCloud.length > 0 ? (
          <Reveal className="lg:col-span-2">
            <article className="card h-full p-6">
              <SectionLabel icon={<Hash className="size-3" />}>Explore hashtags</SectionLabel>
              <div className="mt-5 flex flex-wrap gap-2">
                {tagCloud.map((t) => (
                  <Link key={t.tag} href={`/t/${t.tag}`} className="transition-opacity hover:opacity-80">
                    <Tag variant={t.forYou ? "saffron" : "outline"}>
                      #{t.tag}
                      <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{t.count}</span>
                    </Tag>
                  </Link>
                ))}
              </div>
            </article>
          </Reveal>
        ) : null}

        {/* College leaderboard - SQL aggregate, honest counts */}
        <Reveal delay={0.1}>
          <article className="card h-full p-6">
            <SectionLabel icon={<Trophy className="size-3" />}>Colleges by members</SectionLabel>
            {leaderboard.length > 0 ? (
              <ul className="mt-4 divide-y divide-bone">
                {leaderboard.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`w-7 shrink-0 text-center font-serif text-2xl tabular-nums ${
                          i === 0 ? "text-gold" : i < 3 ? "text-saffron" : "text-ash"
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
              <p className="mt-6 text-sm text-ash">Not enough members yet.</p>
            )}
          </article>
        </Reveal>
      </div>
    </div>
  );
}
