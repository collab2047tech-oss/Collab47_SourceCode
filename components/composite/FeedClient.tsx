"use client";

import { useCallback, useRef, useState } from "react";
import { PostComposer, type OptimisticPostInput } from "@/components/composite/PostComposer";
import { FeedFilters, type FeedPrefs } from "@/components/composite/FeedFilters";
import { HomeFeed } from "@/components/composite/HomeFeed";
import { loadFeedPageAction } from "@/app/(app)/home/feed-page-actions";
import type { Post as CardPost } from "@/components/composite/PostCard";
import type { FeedTab } from "@/lib/db/feed";
import { relativeTime } from "@/lib/ui/toCardPost";

interface InitialTab {
  posts: CardPost[];
  nextCursor: string | null;
}

interface FeedClientProps {
  /** Server-rendered first page of the default tab (For you). */
  initialForYou: InitialTab;
  /** Whether Recent is a global discovery stream for this viewer. */
  recentIsDiscovery: boolean;
  initialPrefs: FeedPrefs;
  currentUserId: string;
  me: { name: string; handle: string; avatar_url: string | null };
  suggestedTags: string[];
  /** The createPostAction server action. */
  createAction: (formData: FormData) => Promise<{ ok: boolean; postId?: string; shortId?: string; error?: string }>;
}

type TabState = { posts: CardPost[]; cursor: string | null; loaded: boolean; loading: boolean };

const EMPTY_TAB: TabState = { posts: [], cursor: null, loaded: false, loading: false };

export function FeedClient({
  initialForYou,
  recentIsDiscovery,
  initialPrefs,
  currentUserId,
  me,
  suggestedTags,
  createAction,
}: FeedClientProps) {
  const [tab, setTab] = useState<FeedTab>("foryou");
  const [prefs, setPrefs] = useState<FeedPrefs>(initialPrefs);

  const [tabs, setTabs] = useState<Record<FeedTab, TabState>>({
    foryou: { posts: initialForYou.posts, cursor: initialForYou.nextCursor, loaded: true, loading: false },
    recent: { ...EMPTY_TAB },
    popular: { ...EMPTY_TAB },
    trending: { ...EMPTY_TAB },
  });

  // Guard so concurrent loads of the same tab don't double-append.
  const inFlight = useRef<Set<FeedTab>>(new Set());

  const fetchPage = useCallback(
    async (which: FeedTab, mode: "first" | "more", prefsArg: FeedPrefs) => {
      if (inFlight.current.has(which)) return;
      inFlight.current.add(which);
      setTabs((prev) => ({ ...prev, [which]: { ...prev[which], loading: true } }));

      const cursor = mode === "more" ? tabs[which].cursor : null;
      const excludeIds = mode === "more" ? tabs[which].posts.map((p) => p.id) : [];

      try {
        const res = await loadFeedPageAction(which, cursor, excludeIds, prefsArg);
        setTabs((prev) => {
          const existing = mode === "more" ? prev[which].posts : [];
          const seen = new Set(existing.map((p) => p.id));
          const merged = [...existing, ...res.posts.filter((p) => !seen.has(p.id))];
          return {
            ...prev,
            [which]: { posts: merged, cursor: res.nextCursor, loaded: true, loading: false },
          };
        });
      } catch {
        setTabs((prev) => ({ ...prev, [which]: { ...prev[which], loading: false, loaded: true } }));
      } finally {
        inFlight.current.delete(which);
      }
    },
    [tabs]
  );

  // Lazy-load a tab's first page the first time it is activated.
  const handleTabChange = useCallback(
    (next: FeedTab) => {
      setTab(next);
      if (!tabs[next].loaded && !tabs[next].loading) {
        void fetchPage(next, "first", prefs);
      }
    },
    [tabs, fetchPage, prefs]
  );

  const handleLoadMore = useCallback(() => {
    if (tabs[tab].cursor && !tabs[tab].loading) void fetchPage(tab, "more", prefs);
  }, [tab, tabs, fetchPage, prefs]);

  // -------------------------------------------------------------------------
  // Filters: persist in the background; re-apply optimistically client-side
  // (hide_projects) and reset every loaded tab so the next page uses new prefs.
  // -------------------------------------------------------------------------
  const handlePrefsChange = useCallback(
    (next: FeedPrefs) => {
      setPrefs(next);
      // Reset every non-active tab so its next activation refetches with the new
      // prefs (no stale, wrong-pref posts linger). The active tab refetches now.
      setTabs((prev) => {
        const out = {} as Record<FeedTab, TabState>;
        (Object.keys(prev) as FeedTab[]).forEach((k) => {
          out[k] = k === tab ? prev[k] : { ...EMPTY_TAB };
        });
        return out;
      });
      // Refetch the ACTIVE tab's first page right away with the new prefs.
      void fetchPage(tab, "first", next);
    },
    [tab, fetchPage]
  );

  // -------------------------------------------------------------------------
  // Optimistic new post: insert at the top of For-you + Recent instantly.
  // -------------------------------------------------------------------------
  const addOptimisticPost = useCallback(
    (input: OptimisticPostInput): string => {
      const tempId = `optimistic-${Date.now()}`;
      const card: CardPost = {
        id: tempId,
        short_id: tempId,
        author_id: currentUserId,
        author: { name: me.name, handle: me.handle, college: "", avatar_url: me.avatar_url },
        time: relativeTime(new Date().toISOString()),
        created_at: new Date().toISOString(),
        body: input.body,
        tags: input.hashtags,
        images: input.image_urls,
        video: input.video_url,
        stats: { likes: 0, comments: 0, saves: 0, reposts: 0 },
        variant: "standard",
        pending: true,
      };
      setTabs((prev) => ({
        ...prev,
        foryou: { ...prev.foryou, posts: [card, ...prev.foryou.posts] },
        recent: prev.recent.loaded
          ? { ...prev.recent, posts: [card, ...prev.recent.posts] }
          : prev.recent,
      }));
      return tempId;
    },
    [currentUserId, me]
  );

  const resolveOptimisticPost = useCallback(
    (tempId: string, result: { ok: boolean; postId?: string; shortId?: string }) => {
      setTabs((prev) => {
        const fix = (s: TabState): TabState => {
          if (result.ok && result.postId && result.shortId) {
            return {
              ...s,
              posts: s.posts.map((p) =>
                p.id === tempId
                  ? { ...p, id: result.postId!, short_id: result.shortId!, pending: false }
                  : p
              ),
            };
          }
          // Failed: drop the optimistic card.
          return { ...s, posts: s.posts.filter((p) => p.id !== tempId) };
        };
        return {
          ...prev,
          foryou: fix(prev.foryou),
          recent: fix(prev.recent),
        };
      });
    },
    []
  );

  const current = tabs[tab];

  return (
    <>
      <div id="composer" className="scroll-mt-24">
        <PostComposer
          action={createAction}
          me={{ name: me.name, avatar_url: me.avatar_url }}
          suggestedTags={suggestedTags}
          onOptimisticPost={addOptimisticPost}
          onResolvePost={resolveOptimisticPost}
        />
      </div>

      <FeedFilters initial={initialPrefs} onChange={handlePrefsChange} />

      <HomeFeed
        tab={tab}
        onTabChange={handleTabChange}
        posts={current.posts}
        hasMore={Boolean(current.cursor)}
        loading={current.loading}
        recentIsDiscovery={recentIsDiscovery}
        onLoadMore={handleLoadMore}
        currentUserId={currentUserId}
      />
    </>
  );
}
