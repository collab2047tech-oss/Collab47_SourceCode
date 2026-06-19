"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NewsItem } from "@/lib/supabase/types";
import { ChevronDown, ExternalLink, Heart } from "lucide-react";
import {
  loadProfile,
  saveProfile,
  reinforce,
  rankShuffle,
  type InterestProfile,
} from "@/lib/newsPersonalize";
import { NewsActions } from "@/components/composite/NewsActions";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  items: NewsItem[];
}

interface Slot {
  item: NewsItem;
  key: string;
}

export function InShortsFeed({ items }: Props) {
  const [order, setOrder] = useState<Slot[]>(() => items.map((it) => ({ item: it, key: it.id })));
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const profileRef = useRef<InterestProfile>({ weights: {} });
  const cycleRef = useRef(0);
  const indexRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    setOrder(makeCycle(p, 0));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [makeCycle]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || order.length === 0) return;
    indexRef.current = Math.round(el.scrollTop / el.clientHeight);
    if (indexRef.current >= order.length - 2) {
      cycleRef.current += 1;
      setOrder((prev) => [...prev, ...makeCycle(profileRef.current, cycleRef.current)]);
    }
  }

  function onInterested(item: NewsItem) {
    const p = reinforce(profileRef.current, item, 2);
    profileRef.current = p;
    saveProfile(p);
    setLiked((prev) => new Set(prev).add(item.id));
    setOrder((prev) => {
      const cut = indexRef.current + 1;
      const head = prev.slice(0, cut);
      const tail = rankShuffle(prev.slice(cut).map((s) => s.item), p).map((it, i) => ({
        item: it,
        key: `${it.id}-r${cycleRef.current}-${i}`,
      }));
      return [...head, ...tail];
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-16 top-16 z-30 flex flex-col bg-cream md:bottom-0 md:left-60">
      {order.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-serif text-h2 text-ink">Nothing yet.</p>
          <p className="mt-2 text-body-sm text-ash">The news engine runs hourly. Check back soon.</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          data-lenis-prevent
          className="relative min-h-0 flex-1 snap-y snap-mandatory overflow-y-scroll no-scrollbar"
        >
          {order.map(({ item, key }, idx) => (
            <article key={key} className="relative flex h-full snap-start snap-always flex-col">
              {item.image_url ? (
                <div className="relative h-[36%] w-full shrink-0 overflow-hidden bg-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
                  <span className="absolute bottom-3 left-4 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium uppercase tracking-widest text-cream">
                    {item.source}
                  </span>
                </div>
              ) : (
                <div className="flex h-20 w-full shrink-0 items-end bg-[linear-gradient(135deg,#0A0F1C_0%,#1E40D6_100%)] p-5">
                  <span className="text-xs font-medium uppercase tracking-widest text-cream/90">{item.source}</span>
                </div>
              )}

              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-5 md:px-10">
                <h2 className="font-serif text-h3 font-medium leading-snug text-ink">{item.title}</h2>

                {item.excerpt ? (
                  <p className="mt-3 flex-1 overflow-y-auto text-body leading-relaxed text-ink/85 no-scrollbar">
                    {item.excerpt}
                  </p>
                ) : (
                  <p className="mt-3 flex-1 text-body-sm text-ash">Open to read the full story.</p>
                )}

                {item.branch_tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.branch_tags.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full bg-saffron/10 px-2.5 py-0.5 text-xs font-medium text-saffron">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  <span className="text-caption">{timeAgo(item.published_at)}</span>

                  <div className="flex items-center gap-2">
                    <NewsActions
                      newsId={item.id}
                      initialLikeCount={item.like_count}
                      initialDislikeCount={item.dislike_count}
                      commentCount={item.comment_count}
                      myReaction={null}
                      compact
                    />

                    {/* Local personalisation (no DB) */}
                    <button
                      type="button"
                      onClick={() => onInterested(item)}
                      title="More like this"
                      className={[
                        "inline-flex items-center justify-center rounded-full border p-2 transition-colors",
                        liked.has(item.id)
                          ? "border-saffron bg-saffron/10 text-saffron"
                          : "border-bone text-ash hover:border-ink hover:text-ink",
                      ].join(" ")}
                    >
                      <Heart className={liked.has(item.id) ? "size-4 fill-saffron" : "size-4"} />
                    </button>

                    {/* External publisher site */}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open on ${item.source}`}
                      className="inline-flex items-center justify-center rounded-full border border-bone p-2 text-ash transition-colors hover:border-ink hover:text-ink"
                    >
                      <ExternalLink className="size-4" />
                    </a>

                    {/* In-app reader */}
                    <Link
                      href={`/news/${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-saffron"
                    >
                      Read in app
                    </Link>
                  </div>
                </div>
              </div>

              {idx === 0 && order.length > 1 ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center text-ash">
                  <span className="text-[11px] uppercase tracking-widest">Swipe up for next</span>
                  <ChevronDown className="size-4 animate-bounce" />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
