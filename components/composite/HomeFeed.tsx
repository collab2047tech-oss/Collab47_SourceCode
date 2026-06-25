"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PostCard, type Post as CardPost } from "@/components/composite/PostCard";
import { cn } from "@/lib/cn";
import { Rss, Clock, Flame, TrendingUp } from "lucide-react";
import { FeedTracker } from "@/components/composite/FeedTracker";

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
  const reduce = useReducedMotion();

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: "foryou", label: "For you", icon: Rss, count: forYou.length },
    { id: "recent", label: "Recent", icon: Clock, count: recent.length },
    { id: "popular", label: "Popular", icon: Flame, count: popular.length },
    { id: "trending", label: "Trending", icon: TrendingUp, count: trending.length },
  ];

  const posts =
    tab === "foryou" ? forYou : tab === "recent" ? recent : tab === "popular" ? popular : trending;

  return (
    <>
      {/* Real behavioural-signal capture (impressions + dwell) for the ranker. */}
      <FeedTracker />
      {/* Sticky tab bar — horizontally scrollable on mobile, never overflows the page. */}
      <div
        className={cn(
          "sticky top-16 z-30 -mx-4 md:-mx-8",
          "border-b border-bone bg-cream/90 backdrop-blur-md"
        )}
      >
        <div
          role="tablist"
          aria-label="Feed sort"
          className="flex items-center gap-0 overflow-x-auto px-4 no-scrollbar md:px-8"
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-3.5 py-3.5 text-sm font-medium",
                  "min-h-11 transition-colors active:scale-95",
                  "sm:px-4",
                  active ? "text-ink" : "text-ash hover:text-ink"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{t.label}</span>
                {t.count > 0 ? (
                  <span
                    className={cn(
                      "hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none transition-colors sm:inline-block",
                      active ? "bg-saffron/15 text-saffron-dk" : "bg-bone text-ash"
                    )}
                  >
                    {t.count}
                  </span>
                ) : null}
                {active ? (
                  <motion.span
                    layoutId={reduce ? undefined : "home-feed-tab-underline"}
                    className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-saffron sm:inset-x-3"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="mt-0">
        <PostsTab key={tab} posts={posts} tab={tab} currentUserId={currentUserId} />
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
  const reduce = useReducedMotion();

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
      {posts.map((p, i) => (
        <motion.div
          key={p.id}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduce ? 0 : 0.5,
            delay: reduce ? 0 : Math.min(i * 0.05, 0.4),
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <PostCard post={p} currentUserId={currentUserId} />
        </motion.div>
      ))}
    </div>
  );
}
