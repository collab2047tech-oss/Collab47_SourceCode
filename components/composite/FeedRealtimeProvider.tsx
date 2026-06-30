"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Live aggregate counters carried on every post row (maintained by triggers). */
export interface PostCounts {
  like_count: number;
  comment_count: number;
  repost_count: number;
  bookmark_count: number;
}

type Listener = (counts: PostCounts) => void;

interface FeedRealtimeValue {
  /** Subscribe a card to live count updates for one post. Returns an unsubscribe. */
  register: (postId: string, cb: Listener) => () => void;
}

const NOOP: FeedRealtimeValue = { register: () => () => {} };
const FeedRealtimeContext = createContext<FeedRealtimeValue | null>(null);

/**
 * FeedRealtimeProvider - ONE Supabase Realtime channel for the whole app shell,
 * fanned out client-side to every PostCard on screen.
 *
 * Why one channel + a client registry (not one channel per post): a feed shows
 * many posts; opening N channels is wasteful and races on mount/unmount. Instead
 * we subscribe once to UPDATE events on `posts`, keep a Map<postId, listeners>,
 * and dispatch each change only to the cards that registered that id. Cards that
 * aren't mounted cost nothing. RLS still gates which rows a client receives.
 *
 * Reconciliation with optimistic UI: the payload carries the AUTHORITATIVE
 * absolute counts, so a card sets its count to the new value. A viewer's own
 * action already bumped the count optimistically; the echo of that same change
 * resolves to the identical number (no flicker), while another user's action
 * ticks the number up/down live.
 */
export function FeedRealtimeProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef<Map<string, Set<Listener>>>(new Map());

  const register = useCallback((postId: string, cb: Listener) => {
    let set = registry.current.get(postId);
    if (!set) {
      set = new Set();
      registry.current.set(postId, set);
    }
    set.add(cb);
    return () => {
      const s = registry.current.get(postId);
      if (!s) return;
      s.delete(cb);
      if (s.size === 0) registry.current.delete(postId);
    };
  }, []);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel("posts:counts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.new as Partial<PostCounts> & { id?: string };
          if (!row?.id) return;
          const set = registry.current.get(row.id);
          if (!set || set.size === 0) return; // no card on screen for this post
          const counts: PostCounts = {
            like_count: row.like_count ?? 0,
            comment_count: row.comment_count ?? 0,
            repost_count: row.repost_count ?? 0,
            bookmark_count: row.bookmark_count ?? 0,
          };
          for (const cb of set) cb(counts);
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  // POLLING FALLBACK. WebSocket Realtime can fail to deliver in some prod/
  // network conditions (proxies, blocked WS, auth-token timing). To GUARANTEE
  // live-ish counts regardless, every few seconds we refetch the authoritative
  // counts for the posts currently on screen and push them to their cards. This
  // is cheap (one bounded query) and runs only while posts are registered. The
  // realtime channel above still delivers instant updates when it works; this
  // just backstops it so likes/comments/reposts/saves never appear frozen.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    let cancelled = false;
    const tick = async () => {
      const ids = [...registry.current.keys()];
      if (ids.length === 0) return;
      const { data } = await sb
        .from("posts")
        .select("id, like_count, comment_count, repost_count, bookmark_count")
        .in("id", ids.slice(0, 200));
      if (cancelled) return;
      for (const r of (data ?? []) as Array<{ id: string } & Partial<PostCounts>>) {
        const set = registry.current.get(r.id);
        if (!set || set.size === 0) continue;
        const counts: PostCounts = {
          like_count: r.like_count ?? 0,
          comment_count: r.comment_count ?? 0,
          repost_count: r.repost_count ?? 0,
          bookmark_count: r.bookmark_count ?? 0,
        };
        for (const cb of set) cb(counts);
      }
    };
    const interval = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <FeedRealtimeContext.Provider value={{ register }}>
      {children}
    </FeedRealtimeContext.Provider>
  );
}

/**
 * Subscribe to live counts for a post. Safe to call OUTSIDE a provider (public
 * /p and /u pages): it returns a no-op register so cards still render and their
 * own optimistic updates keep working - they just won't receive cross-user ticks.
 */
export function useFeedRealtime(): FeedRealtimeValue {
  return useContext(FeedRealtimeContext) ?? NOOP;
}
