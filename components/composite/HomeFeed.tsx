"use client";

import { useState } from "react";
import { PostCard, type Post as CardPost } from "@/components/composite/PostCard";
import { cn } from "@/lib/cn";
import { Rss, Clock, Flame, TrendingUp } from "lucide-react";

interface HomeFeedProps {
  forYou: CardPost[];
  recent: CardPost[];
  popular: CardPost[];
  trending: CardPost[];
  currentUserId: string;
}

type Tab = "foryou" | "recent" | "popular" | "trending";

export function HomeFeed({ forYou, recent, popular, trending, currentUserId }: HomeFeedProps) {
  const [tab, setTab] = useState<Tab>("foryou");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "foryou", label: "For you", icon: Rss },
    { id: "recent", label: "Recent", icon: Clock },
    { id: "popular", label: "Popular", icon: Flame },
    { id: "trending", label: "Trending", icon: TrendingUp },
  ];

  const posts =
    tab === "foryou" ? forYou : tab === "recent" ? recent : tab === "popular" ? popular : trending;

  return (
    <>
      {/* Sticky tab bar */}
      <div
        className={cn(
          "sticky top-16 z-30 -mx-4 md:-mx-8",
          "border-b border-bone bg-cream/90 backdrop-blur-md"
        )}
      >
        <div className="flex items-center gap-0 overflow-x-auto px-4 no-scrollbar md:px-8">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors",
                  active ? "text-ink" : "text-ash hover:text-ink"
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
                {active ? (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-saffron" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="mt-0">
        <PostsTab posts={posts} tab={tab} currentUserId={currentUserId} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Posts tab
// ---------------------------------------------------------------------------

const EMPTY_COPY: Record<Tab, { title: string; body: string }> = {
  foryou: {
    title: "Your feed is just getting started",
    body: "Follow people or post something. Your personalised feed grows from there.",
  },
  recent: {
    title: "Nobody in your feed yet",
    body: "Follow people to see their latest posts here. Head to Explore to find builders.",
  },
  popular: {
    title: "Nothing popular yet",
    body: "Posts with the most engagement in the last 24 hours will show up here.",
  },
  trending: {
    title: "Nothing trending yet",
    body: "Hot posts from the last 6 hours, tuned to your branch and city, appear here.",
  },
};

function PostsTab({ posts, tab, currentUserId }: { posts: CardPost[]; tab: Tab; currentUserId: string }) {
  if (posts.length === 0) {
    const copy = EMPTY_COPY[tab];
    return (
      <div className="px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-bone">
          <Rss className="size-5 text-ash" />
        </div>
        <p className="font-semibold text-ink">{copy.title}</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-ash">{copy.body}</p>
      </div>
    );
  }
  return (
    <div className="divide-y-0">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
