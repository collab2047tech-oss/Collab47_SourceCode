import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
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
          <h1 className="mt-4 font-serif text-5xl text-ink">
            Find work, people, and{" "}
            <span className="italic text-saffron">your next project.</span>
          </h1>
        </div>
      </Reveal>

      <div className="mt-10">
        <ExploreSearch />
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {/* Featured project */}
        <Reveal className="lg:col-span-2">
          {featured ? (
            <Link
              href={`/c/${featured.short_id}`}
              className="group relative block h-80 overflow-hidden rounded-lg bg-ink"
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A0F1C_0%,#1E40D6_100%)]" />
              <div className="relative flex h-full flex-col justify-end p-8 text-cream">
                <Tag variant="saffron" className="self-start">
                  Featured project
                </Tag>
                <h2 className="mt-4 font-serif text-4xl">{featured.title}</h2>
                <p className="mt-3 max-w-md text-sm text-cream/80 line-clamp-3">{featured.brief}</p>
                <span className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-saffron px-5 py-2.5 text-sm text-cream transition-colors group-hover:bg-saffron-dk">
                  View brief <ChevronRight className="size-4" />
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
          <article className="rounded-lg border border-bone bg-paper p-6">
            <div className="flex items-center gap-2 text-caption">
              <TrendingUp className="size-3" /> Trending now
            </div>
            {trending.length > 0 ? (
              <ul className="mt-6 space-y-4">
                {trending.map((t, i) => (
                  <li key={t.tag}>
                    <Link
                      href={`/t/${t.tag}`}
                      className="group/tag flex items-baseline gap-3"
                    >
                      <span className="font-serif text-2xl text-saffron tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink transition-colors group-hover/tag:text-saffron">
                          #{t.tag}
                        </p>
                        <p className="text-xs text-ash">{t.count} posts</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-ash">No trends yet.</p>
            )}
          </article>
        </Reveal>

        {/* New people */}
        <Reveal>
          <article className="rounded-lg border border-bone bg-paper p-6">
            <div className="flex items-center gap-2 text-caption">
              <Sparkles className="size-3" /> People you may know
            </div>
            {suggested.length > 0 ? (
              <ul className="mt-6 space-y-4">
                {suggested.map((p) => (
                  <li key={p.id}>
                    <Link href={`/u/${p.handle}`} className="flex items-center gap-3">
                      <Avatar name={p.name} src={p.avatar_url ?? undefined} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                        <p className="truncate text-xs text-ash">
                          {[p.branch, p.college].filter(Boolean).join(" . ")}
                        </p>
                      </div>
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
          <article className="rounded-lg border border-bone bg-paper p-6">
            <div className="flex items-center gap-2 text-caption">
              <Trophy className="size-3" /> Colleges by members
            </div>
            {leaderboard.length > 0 ? (
              <ul className="mt-6 divide-y divide-bone">
                {leaderboard.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-4">
                      <span className="font-serif text-3xl text-ink tabular-nums">{i + 1}</span>
                      <span className="text-sm font-medium text-ink">{c.name}</span>
                    </div>
                    <span className="rounded-full bg-saffron/10 px-3 py-1 text-xs font-semibold tabular-nums text-saffron-dk">
                      {c.count} {c.count === 1 ? "member" : "members"}
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
