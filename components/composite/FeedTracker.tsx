"use client";

import { useEffect, useRef } from "react";
import { recordFeedEventsAction, type FeedEventInput } from "@/app/(app)/home/feed-events-actions";

/**
 * Real behavioural-signal capture for the feed. Drop this once anywhere inside a
 * feed; it watches every element carrying a `data-feed-post="<postId>"` attribute
 * (PostCard sets it) and emits:
 *   - "impression" once a card is >=50% visible for >=800ms
 *   - "dwell" with the total visible time when the card scrolls away
 * Events are batched and flushed every 4s + on tab-hide/unload (fire-and-forget).
 *
 * This is the fuel: it fills posts.impressions + user_seen_posts (both otherwise
 * dead) so engagement-rate, dedup and the learned ranker work on REAL data.
 */
export function FeedTracker() {
  const queue = useRef<FeedEventInput[]>([]);
  const visibleSince = useRef<Map<string, number>>(new Map());
  const counted = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const flush = () => {
      if (queue.current.length === 0) return;
      const batch = queue.current;
      queue.current = [];
      // Fire-and-forget; never block the UI.
      void recordFeedEventsAction(batch);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.feedPost;
          if (!id) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!visibleSince.current.has(id)) visibleSince.current.set(id, now);
            // Count an impression after a sustained 800ms of real visibility.
            if (!counted.current.has(id) && !timers.current.has(id)) {
              const t = setTimeout(() => {
                counted.current.add(id);
                queue.current.push({ postId: id, kind: "impression" });
                timers.current.delete(id);
              }, 800);
              timers.current.set(id, t);
            }
          } else {
            const t = timers.current.get(id);
            if (t) { clearTimeout(t); timers.current.delete(id); }
            const start = visibleSince.current.get(id);
            if (start) {
              const dwell = now - start;
              visibleSince.current.delete(id);
              if (counted.current.has(id) && dwell > 300) {
                queue.current.push({ postId: id, kind: "dwell", value: dwell });
              }
            }
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    );

    // Observe current + future feed cards.
    const observed = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-feed-post]").forEach((el) => {
        if (!observed.has(el)) { observed.add(el); io.observe(el); }
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    const interval = setInterval(flush, 4000);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      io.disconnect();
      mo.disconnect();
      clearInterval(interval);
      for (const t of timers.current.values()) clearTimeout(t);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return null;
}
