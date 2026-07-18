"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NewsItem } from "@/lib/supabase/types";
import { ChevronUp, ExternalLink, Newspaper } from "lucide-react";
import {
  loadProfile,
  saveProfile,
  reinforce,
  rankShuffle,
  type InterestProfile,
} from "@/lib/newsPersonalize";
import { NewsActions } from "@/components/composite/NewsActions";
import { loadMoreNewsAction } from "@/app/(content)/news/actions";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  items: NewsItem[];
  /** Pre-resolved saved state keyed by news id (from the server). */
  savedIds?: string[];
}

interface Slot {
  item: NewsItem;
  key: string;
}

export function InShortsFeed({ items, savedIds = [] }: Props) {
  const [order, setOrder] = useState<Slot[]>(() => items.map((it) => ({ item: it, key: it.id })));
  const savedSet = useRef<Set<string>>(new Set(savedIds));
  const profileRef = useRef<InterestProfile>({ weights: {} });
  const cycleRef = useRef(0);
  const indexRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Keyset pagination state for loading EVERY distinct article (no cap).
  const cursorRef = useRef<string | null>(null);   // oldest published_at loaded
  const idsRef = useRef<Set<string>>(new Set());    // every id on screen (dedupe)
  const loadingMoreRef = useRef(false);
  const exhaustedRef = useRef(false);               // archive fully shown

  // The server already field-matched `items`; the local loop re-shuffles WITHIN
  // that relevant set (relevance first, instant personalisation on top).
  const makeCycle = useCallback(
    (p: InterestProfile, c: number): Slot[] =>
      rankShuffle(items, p).map((it) => ({ item: it, key: `${it.id}-c${c}` })),
    [items]
  );

  useEffect(() => {
    const p = loadProfile();
    profileRef.current = p;
    cycleRef.current = 0;
    indexRef.current = 0;
    loadingMoreRef.current = false;
    exhaustedRef.current = false;
    idsRef.current = new Set(items.map((it) => it.id));
    cursorRef.current = items.length > 0 ? items[items.length - 1].published_at : null;
    // First cycle keeps the server's ranked order verbatim (no local re-shuffle)
    // so the most-relevant matched story is the first card you see.
    setOrder(items.map((it) => ({ item: it, key: `${it.id}-c0` })));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [items]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || order.length === 0) return;
    indexRef.current = Math.round(el.scrollTop / el.clientHeight);
    if (indexRef.current < order.length - 3 || loadingMoreRef.current) return;

    // Archive exhausted -> gently re-cycle the personalised set so the reader
    // never dead-ends (last resort only, after EVERY distinct article shown).
    if (exhaustedRef.current) {
      cycleRef.current += 1;
      setOrder((prev) => [...prev, ...makeCycle(profileRef.current, cycleRef.current)]);
      return;
    }

    // Otherwise fetch the NEXT distinct batch of older articles (no cap).
    loadingMoreRef.current = true;
    loadMoreNewsAction(cursorRef.current, [...idsRef.current])
      .then((more) => {
        const fresh = more.filter((m) => !idsRef.current.has(m.id));
        if (fresh.length === 0) {
          exhaustedRef.current = true;
        } else {
          for (const m of fresh) idsRef.current.add(m.id);
          cursorRef.current = fresh[fresh.length - 1].published_at;
          setOrder((prev) => [...prev, ...fresh.map((it) => ({ item: it, key: `${it.id}-m` }))]);
        }
      })
      .catch(() => { exhaustedRef.current = true; })
      .finally(() => { loadingMoreRef.current = false; });
  }

  /**
   * "More like this" - reinforce the instant local interest profile so FUTURE
   * appended cycles float similar stories up. Does NOT re-sort or remove
   * anything currently in `order`; the card stays exactly where it is. (The
   * durable cross-device signal is persisted separately by NewsActions.)
   */
  function reinforceLocal(item: NewsItem) {
    const p = reinforce(profileRef.current, item, 2);
    profileRef.current = p;
    saveProfile(p);
  }

  return (
    <div className="fixed inset-x-0 bottom-16 top-16 z-30 flex flex-col bg-cream md:bottom-0 md:left-60">
      {order.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-bone bg-paper text-ash">
            <Newspaper className="size-7" />
          </div>
          <p className="mt-5 font-serif text-h2 text-ink">Nothing yet.</p>
          <p className="mt-2 max-w-xs text-body-sm text-ink/70">
            The news engine runs hourly. Fresh stories matched to your interests will appear here.
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          data-lenis-prevent
          className="relative min-h-0 flex-1 snap-y snap-mandatory overflow-y-scroll no-scrollbar"
        >
          {order.map(({ item, key }, idx) => {
            return (
              <article
                key={key}
                className="relative flex h-full min-h-0 snap-start snap-always flex-col overflow-hidden"
              >
                {/* Scrollable content (image + headline + summary). min-h-0 lets
                    it shrink; overflow keeps long briefs scrollable WITHIN the
                    card so they never push the action bar off-screen. */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar">
                  {item.image_url ? (
                    <div className="relative aspect-[16/9] max-h-[40vh] w-full shrink-0 overflow-hidden bg-ink">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      {/* bottom scrim so the source chip + topic stay legible */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink/70 to-transparent" />
                      <span className="absolute bottom-3 left-4 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium uppercase tracking-widest text-cream">
                        {item.source}
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-28 w-full shrink-0 items-end justify-between bg-[linear-gradient(135deg,#0A0F1C_0%,#1E40D6_100%)] p-5">
                      <span className="text-xs font-medium uppercase tracking-widest text-cream">
                        {item.source}
                      </span>
                    </div>
                  )}

                  <div className="mx-auto w-full max-w-2xl px-6 py-5 md:px-10">
                    <h2 className="font-serif text-h3 font-medium leading-snug text-ink">{item.title}</h2>

                    {/* Show the AI/curated summary only. Never fall back to the
                        raw publisher blurb (excerpt) - it can be link metadata. */}
                    {item.summary ? (
                      <p className="mt-3 line-clamp-5 text-body leading-relaxed text-ink/85">
                        {item.summary}
                      </p>
                    ) : (
                      <p className="mt-3 text-body italic leading-relaxed text-ink/55">
                        Open the full story to read more.
                      </p>
                    )}

                    <span className="mt-4 block text-caption text-ink/60">{timeAgo(item.published_at)}</span>
                  </div>
                </div>

                {/* Sticky action bar - pinned to the bottom of the card, always
                    visible. Stops pointer/touch events from bubbling to the
                    snap-scroll container so taps never trigger a swipe. */}
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="relative z-20 shrink-0 border-t border-bone bg-cream/95 backdrop-blur supports-backdrop-filter:bg-cream/80"
                >
                  <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-6 py-3 md:px-10">
                    <NewsActions
                      newsId={item.id}
                      commentCount={item.comment_count}
                      initialSaved={savedSet.current.has(item.id)}
                      compact
                      showDiscuss={false}
                      showReport={false}
                      onSignal={(dir) => {
                        if (dir === "more") reinforceLocal(item);
                      }}
                    />

                    <div className="flex items-center gap-2">
                      {/* External publisher site */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open on ${item.source}`}
                        aria-label={`Open on ${item.source}`}
                        className="inline-flex items-center justify-center rounded-full border border-bone p-2 text-ink/70 transition-all hover:border-ink hover:text-ink active:scale-95"
                      >
                        <ExternalLink className="size-4" />
                      </a>

                      {/* In-app reader */}
                      <Link
                        href={`/news/${item.id}`}
                        prefetch
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition-all hover:bg-saffron active:scale-95"
                      >
                        Read in app
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Swipe-up affordance - first card only, sits ABOVE the action
                    bar and is non-interactive so it never intercepts a tap. */}
                {idx === 0 && order.length > 1 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex flex-col items-center text-ink/70">
                    <ChevronUp className="size-4 animate-bounce" />
                    <span className="text-[11px] font-medium uppercase tracking-widest">Swipe up for next</span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
