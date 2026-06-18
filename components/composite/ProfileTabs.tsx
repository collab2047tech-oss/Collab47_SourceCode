"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import type { PostWithAuthor } from "@/lib/db/posts";

const PORTFOLIO_FALLBACK = [
  { id: 1, title: "AI Study Planner", tag: "Product" },
  { id: 2, title: "Crop Disease Detector", tag: "AgriTech" },
  { id: 3, title: "Punjabi News Reels", tag: "Content" },
  { id: 4, title: "Hackathon: Aurora", tag: "Hackathon" },
  { id: 5, title: "Anti-Bias Hiring", tag: "Research" },
  { id: 6, title: "Voice OCR for Hindi", tag: "AI/ML" },
];

type TabId = "portfolio" | "posts" | "projects" | "about";

interface ProfileTabsProps {
  posts: PostWithAuthor[];
}

export function ProfileTabs({ posts }: ProfileTabsProps) {
  const [tab, setTab] = useState<TabId>("portfolio");

  const tabs: { id: TabId; label: string }[] = [
    { id: "portfolio", label: "Portfolio" },
    { id: "posts", label: "Posts" },
    { id: "projects", label: "Projects" },
    { id: "about", label: "About" },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="mt-12 flex items-center gap-1 border-b border-bone">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-5 py-3 text-sm transition-colors",
              tab === t.id
                ? "border-b-2 border-saffron text-ink"
                : "text-ash hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Portfolio */}
      {tab === "portfolio" && (
        <Reveal delay={0.05}>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            {PORTFOLIO_FALLBACK.map((p) => (
              <article
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-lg bg-[linear-gradient(135deg,#E5DFD3_0%,#FBF9F4_100%)] transition-all"
              >
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(44,91,255,0.1)_0%,rgba(11,18,32,0.2)_100%)] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 translate-y-2 p-5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <Tag variant="saffron">{p.tag}</Tag>
                  <p className="mt-2 font-serif text-xl text-ink">{p.title}</p>
                </div>
              </article>
            ))}
          </div>
        </Reveal>
      )}

      {/* Posts */}
      {tab === "posts" && (
        <Reveal delay={0.05}>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            {posts.length === 0 ? (
              <p className="col-span-full py-10 text-center text-ash">
                No posts yet.
              </p>
            ) : (
              posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/p/${p.short_id}`}
                  className="group aspect-square overflow-hidden rounded-lg border border-bone bg-paper p-5 transition-all hover:border-saffron"
                >
                  <p className="line-clamp-6 text-sm text-ink">{p.body}</p>
                </Link>
              ))
            )}
          </div>
        </Reveal>
      )}

      {/* Projects */}
      {tab === "projects" && (
        <Reveal delay={0.05}>
          <div className="mt-10 py-10 text-center text-ash">
            Projects coming soon.
          </div>
        </Reveal>
      )}

      {/* About */}
      {tab === "about" && (
        <Reveal delay={0.05}>
          <div className="mt-10 py-10 text-center text-ash">
            About section coming soon.
          </div>
        </Reveal>
      )}
    </>
  );
}
