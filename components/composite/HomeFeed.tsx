"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PostCard, type Post as CardPost } from "@/components/composite/PostCard";
import { cn } from "@/lib/cn";
import { Rss, Clock, Flame, TrendingUp, Check, Loader2, Users } from "lucide-react";
import { FeedTracker } from "@/components/composite/FeedTracker";
import type { FeedTab } from "@/lib/db/feed";

interface HomeFeedProps {
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  posts: CardPost[];
  /** Whether this tab can load more (cursor present). */
  hasMore: boolean;
  /** True while this tab is fetching its first page or next page. */
  loading: boolean;
  /** Recent tab is showing a global discovery stream (viewer follows nobody). */
  recentIsDiscovery: boolean;
  onLoadMore: () => void;
  currentUserId: string;
}

const TABS: { id: FeedTab; label: string; icon: React.ElementType }[] = [
  { id: "foryou", label: "For you", icon: Rss },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "popular", label: "Popular", icon: Flame },
  { id: "trending", label: "Trending", icon: TrendingUp },
];

export function HomeFeed({
  tab,
  onTabChange,
  posts,
  hasMore,
  loading,
  recentIsDiscovery,
  onLoadMore,
  currentUserId,
}: HomeFeedProps) {
  const reduce = useReducedMotion();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Latest props read by the observer (so it can be created ONCE per tab and
  // never go stale - recreating it on every render caused re-arm races that
  // stalled the infinite scroll after a page or two).
  const loadRef = useRef(onLoadMore);
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(loading);
  loadRef.current = onLoadMore;
  hasMoreRef.current = hasMore;
  loadingRef.current = loading;

  // Infinite scroll observer: created once per tab, fires on every scroll that
  // brings the sentinel within 1200px of the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) loadRef.current();
      },
      { rootMargin: "1200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab]);

  // Post-load "kick": a still-intersecting sentinel does NOT emit a new
  // IntersectionObserver event, so after each page settles we re-check whether
  // the sentinel is still near the viewport and, if so, keep loading until the
  // screen is filled. This is what makes it feel continuous (LinkedIn/YouTube).
  useEffect(() => {
    if (loading || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 1200) onLoadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasMore, posts.length, tab]);

  return (
    <>
      {/* Real behavioural-signal capture (impressions + dwell) for the ranker. */}
      <FeedTracker />

      {/* Sticky tab bar - horizontally scrollable on mobile, never overflows. */}
      <div
        className={cn(
          // Bleed edge-to-edge on mobile/tablet (single column), but NOT at lg+
          // where a right rail exists - the -mx bleed would overlap the rail's
          // Trending card. lg:mx-0 keeps the bar inside its own column.
          "sticky top-16 z-30 -mx-4 md:-mx-8 lg:mx-0",
          "border-b border-bone bg-cream/90 backdrop-blur-md"
        )}
      >
        <div
          role="tablist"
          aria-label="Feed sort"
          className="flex items-center gap-0 overflow-x-auto px-4 no-scrollbar md:px-8 lg:px-5"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(t.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-3.5 py-3.5 text-sm font-medium",
                  "min-h-11 transition-colors active:scale-95 sm:px-4",
                  active ? "text-ink" : "text-ash hover:text-ink"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{t.label}</span>
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
      <PostsList
        key={tab}
        tab={tab}
        posts={posts}
        hasMore={hasMore}
        loading={loading}
        recentIsDiscovery={recentIsDiscovery}
        sentinelRef={sentinelRef}
        currentUserId={currentUserId}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Posts list (first page animates in; appended pages render with no pop-in)
// ---------------------------------------------------------------------------

const EMPTY_COPY: Record<FeedTab, { title: string; body: string }> = {
  foryou: {
    title: "Your feed is just getting started",
    body: "Follow people or post something. Your personalised feed grows from there.",
  },
  recent: {
    title: "Nothing new yet",
    body: "Follow people to see their latest posts here. Head to Explore to find builders.",
  },
  popular: {
    title: "Nothing popular yet",
    body: "Posts with the most engagement in the last 24 hours will show up here.",
  },
  trending: {
    title: "Nothing trending yet",
    body: "Posts accelerating in the last few hours, tuned to your branch and city, appear here.",
  },
};

function PostsList({
  tab,
  posts,
  hasMore,
  loading,
  recentIsDiscovery,
  sentinelRef,
  currentUserId,
}: {
  tab: FeedTab;
  posts: CardPost[];
  hasMore: boolean;
  loading: boolean;
  recentIsDiscovery: boolean;
  sentinelRef: React.RefObject<HTMLDivElement>;
  currentUserId: string;
}) {
  const reduce = useReducedMotion();

  if (posts.length === 0 && !loading) {
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

  // Only the first ~6 cards get an entrance animation; appended pages do not
  // pop in on scroll (LinkedIn/X behaviour).
  return (
    <div>
      {tab === "recent" && recentIsDiscovery && posts.length > 0 ? (
        <div className="flex items-center gap-2 border-b border-bone bg-cream/60 px-4 py-2.5 text-xs text-ash sm:px-5">
          <Users className="size-3.5 shrink-0 text-saffron" />
          <span>
            You are not following anyone yet - here is what is new across Collab47.
          </span>
        </div>
      ) : null}

      {posts.map((p, i) => (
        <motion.div
          key={p.id}
          initial={reduce || i >= 6 ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduce ? 0 : 0.5,
            delay: reduce ? 0 : Math.min(i * 0.05, 0.3),
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <PostCard post={p} currentUserId={currentUserId} />
        </motion.div>
      ))}

      {/* Loading skeletons while a page is in flight. */}
      {loading ? (
        <div aria-hidden className="divide-y divide-bone">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : null}

      {/* Sentinel that triggers the next page. */}
      {hasMore ? <div ref={sentinelRef} className="h-px w-full" /> : null}

      {/* Terminal "all caught up" state. */}
      {!hasMore && !loading && posts.length > 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ash">
          <Check className="size-4 text-moss" />
          <span>You are all caught up.</span>
        </div>
      ) : null}

      {loading && posts.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ash">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex gap-3 px-4 py-5 sm:px-5">
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-bone" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-bone" />
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-bone" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-bone" />
        </div>
        <div className="h-40 w-full animate-pulse rounded-xl bg-bone/70" />
      </div>
    </div>
  );
}
