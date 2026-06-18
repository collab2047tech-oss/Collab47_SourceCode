"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { mockPeople, mockTrending } from "@/lib/mockData";
import { TrendingUp, Sparkles, Trophy, ChevronRight } from "lucide-react";
import { ExploreSearch } from "@/components/composite/ExploreSearch";

export default function ExplorePage() {
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
          <article className="group relative h-80 overflow-hidden rounded-lg bg-ink">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A0A0B_0%,#1F3A2C_100%)]" />
            <div className="relative flex h-full flex-col justify-end p-8 text-cream">
              <Tag variant="saffron" className="self-start">
                Featured project
              </Tag>
              <h2 className="mt-4 font-serif text-4xl">
                The Anti-Bias Hiring Lab.
              </h2>
              <p className="mt-3 max-w-md text-sm text-cream/80">
                A coalition of Tier-2/3 student designers and engineers
                rebuilding the campus hiring stack from scratch. Open call until
                June 30.
              </p>
              <button className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-saffron px-5 py-2.5 text-sm text-cream transition-colors hover:bg-saffron-dk">
                View brief <ChevronRight className="size-4" />
              </button>
            </div>
          </article>
        </Reveal>

        {/* Trending */}
        <Reveal delay={0.1}>
          <article className="rounded-lg border border-bone bg-paper p-6">
            <div className="flex items-center gap-2 text-caption">
              <TrendingUp className="size-3" /> Trending today
            </div>
            <ul className="mt-6 space-y-4">
              {mockTrending.map((t, i) => (
                <li key={t.tag} className="flex items-baseline gap-3">
                  <span className="font-serif text-2xl text-saffron tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">#{t.tag}</p>
                    <p className="text-xs text-ash">
                      {t.count} posts this week
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </Reveal>

        {/* New this week */}
        <Reveal>
          <article className="rounded-lg border border-bone bg-paper p-6">
            <div className="flex items-center gap-2 text-caption">
              <Sparkles className="size-3" /> Joined this week
            </div>
            <ul className="mt-6 space-y-4">
              {mockPeople.slice(0, 4).map((p) => (
                <li key={p.handle} className="flex items-center gap-3">
                  <Avatar name={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-ash">
                      {p.role} . {p.college}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </Reveal>

        {/* College leaderboard */}
        <Reveal delay={0.1} className="lg:col-span-2">
          <article className="rounded-lg border border-bone bg-paper p-6">
            <div className="flex items-center gap-2 text-caption">
              <Trophy className="size-3" /> College leaderboard . this month
            </div>
            <ul className="mt-6 divide-y divide-bone">
              {[
                { name: "Thapar Institute", score: 4.8, posts: 312 },
                { name: "Punjabi University", score: 4.6, posts: 287 },
                { name: "GNDU Amritsar", score: 4.4, posts: 241 },
                { name: "IIT Ropar", score: 4.3, posts: 198 },
                { name: "DAV Amritsar", score: 4.1, posts: 156 },
              ].map((c, i) => (
                <li key={c.name} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <span className="font-serif text-3xl text-ink tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-ink">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-ash">
                    <span className="tabular-nums">{c.posts} posts</span>
                    <span className="rounded-full bg-saffron/10 px-3 py-1 font-semibold tabular-nums text-saffron-dk">
                      {c.score.toFixed(1)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </Reveal>
      </div>
    </div>
  );
}
