"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { useReducedMotion } from "motion/react";
import { Play, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface PostMediaProps {
  images: string[];
  video: string | null;
  shortId: string;
  /** Fired on double-click / double-tap of an image tile (IG-style like). */
  onDoubleLike?: () => void;
  /** Toned-down rendering for the embedded original card inside a repost. */
  compact?: boolean;
}

/**
 * The real feed media gallery.
 *  - video      -> inline <video controls preload="metadata"> in a framed mat.
 *  - 1 image    -> full-width, object-contain on a mat so portraits/screenshots
 *                  are never cropped (Instagram behaviour).
 *  - 2+ images  -> swipeable carousel (LinkedIn behaviour).
 * Each image tile links to the post; double-click likes it.
 *
 * The carousel replaced the old 2/3/4-up grids. Those grids capped at four
 * tiles with a "+N" badge on the fourth, and the post DETAIL page rendered the
 * same grid - so on a seven-image post, images five to seven could not be
 * viewed anywhere in the app. Every image is now reachable.
 */
export function PostMedia({ images, video, shortId, onDoubleLike, compact }: PostMediaProps) {
  if (video) {
    return <VideoTile src={video} compact={compact} onDoubleLike={onDoubleLike} />;
  }

  const imgs = images.filter(Boolean);
  if (imgs.length === 0) return null;

  const radius = compact ? "rounded-lg" : "rounded-xl";

  // Single image: contain on a mat (no crop), capped height.
  if (imgs.length === 1) {
    return (
      <MediaFrame className={cn("mt-3 sm:mt-4", radius)} onDoubleLike={onDoubleLike}>
        <Wrap
          shortId={shortId}
          compact={compact}
          className={cn(
            "flex w-full items-center justify-center overflow-hidden bg-ink/[0.04]",
            radius,
            "border border-bone",
            compact ? "max-h-80" : "max-h-[22rem] sm:max-h-[32rem]"
          )}
        >
          <img
            src={imgs[0]}
            alt=""
            loading="lazy"
            className={cn(
              "h-auto w-full object-contain",
              compact ? "max-h-80" : "max-h-[22rem] sm:max-h-[32rem]"
            )}
          />
        </Wrap>
      </MediaFrame>
    );
  }

  // Two or more: swipeable carousel.
  return (
    <MediaFrame className={cn("mt-3 sm:mt-4", radius)} onDoubleLike={onDoubleLike}>
      <ImageCarousel images={imgs} shortId={shortId} compact={compact} radius={radius} />
    </MediaFrame>
  );
}

/**
 * LinkedIn-style photo carousel.
 *
 * Scrolling is native CSS scroll-snap rather than a JS transform track: touch
 * swipe, trackpad and momentum all come for free and stay at 60fps, and it
 * degrades to a plain scroller if JS is slow to hydrate. JS only drives the
 * arrows, the dots and the current-index readout.
 *
 * The track is a FIXED height (not max-height) so every slide occupies the
 * same box - the card never resizes as you swipe, and there is no CLS. Images
 * are object-contain on a mat, so portraits and screenshots are never cropped.
 */
function ImageCarousel({
  images,
  shortId,
  compact,
  radius,
}: {
  images: string[];
  shortId: string;
  compact?: boolean;
  radius: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const count = images.length;

  const onScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const el = trackRef.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const next = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / width)));
      setIndex((prev) => (prev === next ? prev : next));
    });
  }, [count]);

  const goTo = useCallback(
    (target: number) => {
      const el = trackRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(count - 1, target));
      el.scrollTo({
        left: clamped * el.clientWidth,
        behavior: reduce ? "auto" : "smooth",
      });
    },
    [count, reduce]
  );

  // Arrows and dots sit inside a tile that links to the post, so every control
  // must swallow the click (and the double-click, which would otherwise trigger
  // the double-tap-to-like gesture on the frame above).
  const swallow = {
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  const height = compact ? "h-64" : "h-[22rem] sm:h-[30rem]";

  return (
    <div
      className="group/carousel relative"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${count} photos`}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={`${count} photos, use arrow keys to browse`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(index + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(index - 1);
          }
        }}
        className={cn(
          "no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          "border border-bone bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50",
          radius,
          height
        )}
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="w-full shrink-0 snap-center"
            role="group"
            aria-roledescription="slide"
            aria-label={`Photo ${i + 1} of ${count}`}
          >
            <Wrap
              shortId={shortId}
              compact={compact}
              className="flex size-full items-center justify-center"
            >
              <img
                src={src}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                className="size-full object-contain"
              />
            </Wrap>
          </div>
        ))}
      </div>

      {/* Counter pill - always visible, the cheapest "there is more" signal. */}
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-paper tabular-nums">
        {index + 1}/{count}
      </span>

      {/* Arrows: pointer devices only. Touch users swipe, and permanently
          parked arrows would just cover the photo. Revealed on hover, and on
          keyboard focus so they are never unreachable. */}
      {!compact ? (
        <>
          {index > 0 ? (
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(index - 1);
              }}
              {...swallow}
              className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 shadow-md transition-opacity hover:bg-paper focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron group-hover/carousel:opacity-100 sm:flex"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {index < count - 1 ? (
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(index + 1);
              }}
              {...swallow}
              className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 shadow-md transition-opacity hover:bg-paper focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron group-hover/carousel:opacity-100 sm:flex"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}
        </>
      ) : null}

      {/* Dots: only while they stay legible. Past that the counter carries it. */}
      {count <= 8 ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(i);
              }}
              {...swallow}
              className="flex size-5 items-center justify-center focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block rounded-full transition-all",
                  i === index ? "size-2 bg-paper" : "size-1.5 bg-paper/55"
                )}
              />
            </button>
          ))}
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite">
        Photo {index + 1} of {count}
      </span>
    </div>
  );
}

/**
 * Links to the post unless `compact` (the embedded repost card is already a
 * Link, and nesting anchors is invalid HTML).
 */
function Wrap({
  shortId,
  compact,
  className,
  children,
}: {
  shortId: string;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (compact) return <div className={className}>{children}</div>;
  return (
    <Link href={`/p/${shortId}`} className={className}>
      {children}
    </Link>
  );
}

/** Wraps the gallery, owns the double-tap-to-like gesture + heart burst. */
function MediaFrame({
  children,
  className,
  onDoubleLike,
}: {
  children: React.ReactNode;
  className?: string;
  onDoubleLike?: () => void;
}) {
  const [burst, setBurst] = useState(false);
  function handleDoubleClick() {
    if (!onDoubleLike) return;
    onDoubleLike();
    setBurst(true);
    window.setTimeout(() => setBurst(false), 650);
  }
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onDoubleClick={onDoubleLike ? handleDoubleClick : undefined}
    >
      {children}
      {burst ? (
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Heart className="size-20 animate-[heartburst_650ms_ease-out] fill-paper text-paper drop-shadow-lg" />
        </span>
      ) : null}
    </div>
  );
}

function VideoTile({
  src,
  compact,
  onDoubleLike,
}: {
  src: string;
  compact?: boolean;
  onDoubleLike?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const radius = compact ? "rounded-lg" : "rounded-xl";

  function play() {
    setPlaying(true);
    // Allow the controls/native UI to take over on the next frame.
    window.requestAnimationFrame(() => ref.current?.play().catch(() => {}));
  }

  return (
    <MediaFrame
      className={cn("mt-3 border border-bone bg-ink sm:mt-4", radius, compact ? "max-h-80" : "max-h-[22rem] sm:max-h-[32rem]")}
      onDoubleLike={onDoubleLike}
    >
      <video
        ref={ref}
        src={src}
        controls={playing}
        preload="metadata"
        playsInline
        onPlay={() => setPlaying(true)}
        className={cn("w-full bg-ink object-contain", compact ? "max-h-80" : "max-h-[22rem] sm:max-h-[32rem]")}
      />
      {!playing ? (
        <button
          type="button"
          onClick={play}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-ink/20 transition-colors hover:bg-ink/10"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-paper/90 shadow-lg transition-transform hover:scale-105 active:scale-95">
            <Play className="ml-1 size-7 fill-ink text-ink" />
          </span>
        </button>
      ) : null}
    </MediaFrame>
  );
}
