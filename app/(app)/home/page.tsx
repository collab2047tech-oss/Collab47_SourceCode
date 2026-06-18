"use client";

import { PostCard } from "@/components/composite/PostCard";
import { PostComposer } from "@/components/composite/PostComposer";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import { mockPosts, mockPeople, mockTrending } from "@/lib/mockData";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createPostAction } from "./actions";

export default function HomePage() {
  const [tab, setTab] = useState<"foryou" | "following" | "news">("foryou");

  return (
    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_320px]">
      {/* Center feed */}
      <div className="max-w-2xl">
        {/* Composer */}
        <Reveal>
          <div className="mb-6">
            <PostComposer action={createPostAction} />
          </div>
        </Reveal>

        {/* Tabs */}
        <div className="sticky top-16 z-30 -mx-4 mb-2 flex items-center gap-1 border-b border-bone bg-cream/90 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8">
          {[
            { id: "foryou", label: "For you" },
            { id: "following", label: "Following" },
            { id: "news", label: "News" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-ink text-cream"
                  : "text-ink/70 hover:bg-bone"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <Reveal>
          <div>
            {mockPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </Reveal>
      </div>

      {/* Right rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-8">
          <Reveal>
            <section>
              <p className="text-caption mb-4">Trending in your network</p>
              <div className="space-y-3 rounded-lg border border-bone bg-paper p-5">
                {mockTrending.map((t) => (
                  <div key={t.tag} className="flex items-baseline justify-between">
                    <p className="text-sm font-medium text-ink">#{t.tag}</p>
                    <p className="text-xs text-ash tabular-nums">{t.count}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.1}>
            <section>
              <p className="text-caption mb-4">People to follow</p>
              <div className="space-y-3 rounded-lg border border-bone bg-paper p-5">
                {mockPeople.slice(0, 4).map((p) => (
                  <div key={p.handle} className="flex items-center gap-3">
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {p.name}
                      </p>
                      <p className="truncate text-xs text-ash">
                        {p.role} . {p.college}
                      </p>
                    </div>
                    <button className="rounded-full bg-ink px-3 py-1 text-xs text-cream transition-colors hover:bg-saffron">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.2}>
            <section>
              <p className="text-caption mb-4">Daily brief</p>
              <article className="rounded-lg border border-bone bg-paper p-5">
                <Tag variant="saffron">News</Tag>
                <h3 className="mt-3 font-serif text-lg text-ink">
                  India IT export incentives: what changes for final-year CSE students.
                </h3>
                <p className="mt-2 text-xs text-ash">
                  3 min read . Career-Impact engine
                </p>
              </article>
            </section>
          </Reveal>
        </div>
      </aside>
    </div>
  );
}
