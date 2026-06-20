import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { ExploreSearch } from "@/components/composite/ExploreSearch";
import { listOpenProjects } from "@/lib/db/projects";
import { getPopularFeed } from "@/lib/db/feed";
import { getSuggestedConnections } from "@/lib/db/social";
import { getSupabaseServer } from "@/lib/supabase/server";
import { TrendingUp, Sparkles, Trophy, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

async function getCollegeLeaderboard(limit = 5) {
  const sb = await getSupabaseServer();
  if (!sb) return [] as { name: string; count: number }[];
  const { data } = await sb.from("profiles").select("college").is("deleted_at", null).limit(1000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const c = (row.college as string | null)?.trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

// listOpenProjects() selects "*" but its inferred row type collapses to the
// normalized `{ member_count }` shape (the spread of Record<string, unknown>
// loses the concrete columns). The underlying row always carries these fields,
// so narrow to just what this page renders.
type FeaturedProject = {
  short_id: string;
  title: string;
  brief: string | null;
};

export default async function ExplorePage() {
  const [projects, popular, suggested, leaderboard] = await Promise.all([
    listOpenProjects(1),
    getPopularFeed(40),
    getSuggestedConnections(4),
    getCollegeLeaderboard(5),
  ]);

  const featured = (projects[0] as unknown as FeaturedProject | undefined) ?? null;

  const counts = new Map<string, number>();
  for (const p of popular) {
    for (const t of p.hashtags ?? []) {
      const tag = t.toLowerCase();
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const trending = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

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

      <Reveal>
        <div className="mt-4 flex items-center gap-3">
          <p className="text-caption shrink-0">On the radar</p>
          <span className="h-px flex-1 bg-bone" />
        </div>
      </Reveal>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Featured project */}
        <Reveal className="lg:col-span-2">
          {featured ? (
            <Link
              href={`/c/${featured.short_id}`}
              className="group relative block h-72 overflow-hidden rounded-lg bg-ink sm:h-80"
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A0F1C_0%,#1E40D6_100%)]" />
              <div className="relative flex h-full flex-col justify-end p-6 text-cream sm:p-8">
                <Tag variant="saffron" className="self-start">
                  Featured project
                </Tag>
                <h2 className="mt-4 font-serif text-2xl leading-tight sm:text-3xl md:text-4xl">{featured.title}</h2>
                <p className="mt-3 max-w-md text-sm text-cream/80 line-clamp-2 sm:line-clamp-3">{featured.brief}</p>
                <span className="mt-5 inline-flex items-center gap-2 self-start rounded-full bg-saffron px-5 py-2.5 text-sm text-cream transition-all group-hover:bg-saffron-dk group-active:scale-95 sm:mt-6">
                  View brief <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed border-bone bg-paper/50 text-center">
              <p className="text-sm text-ash">No open projects yet.</p>
              <Link href="/collabs/new" className="mt-2 text-sm text-saffron underline">
                Start the first one
              </Link>
            </div>
          )}
        </Reveal>

        {/* Trending */}
        <Reveal delay={0.1}>
          <article className="card h-full p-6">
            <div className="flex items-center gap-2 text-caption">
              <TrendingUp className="size-3" /> Trending now
            </div>
            {trending.length > 0 ? (
              <ul className="mt-6 space-y-1">
                {trending.map((t, i) => (
                  <li key={t.tag}>
                    <Link
                      href={`/t/${t.tag}`}
                      className="group/tag -mx-2 flex items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-cream"
                    >
                      <span className="font-serif text-2xl text-saffron tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink transition-colors group-hover/tag:text-saffron">
                          #{t.tag}
                        </p>
                        <p className="text-xs text-ash tabular-nums">
                          {t.count} {t.count === 1 ? "post" : "posts"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 self-center text-ash opacity-0 transition-all group-hover/tag:translate-x-0.5 group-hover/tag:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-ash">No trends yet. Post something with a #hashtag to start one.</p>
            )}
          </article>
        </Reveal>

        {/* New people */}
        <Reveal>
          <article className="card h-full p-6">
            <div className="flex items-center gap-2 text-caption">
              <Sparkles className="size-3" /> People you may know
            </div>
            {suggested.length > 0 ? (
              <ul className="mt-6 space-y-1">
                {suggested.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/u/${p.handle}`}
                      className="group/p -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-cream"
                    >
                      <Avatar name={p.name} src={p.avatar_url ?? undefined} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink transition-colors group-hover/p:text-saffron">{p.name}</p>
                        <p className="truncate text-xs text-ash">
                          {[p.branch, p.college].filter(Boolean).join(" . ") || "On Collab47"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-ash opacity-0 transition-all group-hover/p:translate-x-0.5 group-hover/p:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-ash">No one to suggest yet.</p>
            )}
          </article>
        </Reveal>

        {/* College leaderboard */}
        <Reveal delay={0.1} className="lg:col-span-2">
          <article className="card h-full p-6">
            <div className="flex items-center gap-2 text-caption">
              <Trophy className="size-3" /> Colleges by members
            </div>
            {leaderboard.length > 0 ? (
              <ul className="mt-4 divide-y divide-bone">
                {leaderboard.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <span
                        className={`w-8 shrink-0 text-center font-serif text-2xl tabular-nums sm:text-3xl ${
                          i === 0 ? "text-gold" : i < 3 ? "text-saffron" : "text-ink/40"
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
