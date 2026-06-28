"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { Play, Heart } from "lucide-react";
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
 *  - 2 images   -> 2-col equal grid.
 *  - 3 images   -> one tall left + two stacked right.
 *  - 4 images   -> 2x2 grid.
 *  - 5+ images  -> 2x2 grid, the 4th tile shows a dimmed "+N" overlay.
 * Each image tile links to the post; double-click likes it.
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

  // Two images: equal side-by-side.
  if (imgs.length === 2) {
    return (
      <MediaFrame className={cn("mt-3 grid grid-cols-2 gap-1 sm:mt-4", radius)} onDoubleLike={onDoubleLike}>
        {imgs.map((src, i) => (
          <GridTile key={i} src={src} shortId={shortId} compact={compact} className="aspect-square" />
        ))}
      </MediaFrame>
    );
  }

  // Three images: one tall left, two stacked right.
  if (imgs.length === 3) {
    return (
      <MediaFrame
        className={cn("mt-3 grid h-72 grid-cols-2 grid-rows-2 gap-1 sm:mt-4 sm:h-80", radius)}
        onDoubleLike={onDoubleLike}
      >
        <GridTile src={imgs[0]} shortId={shortId} compact={compact} className="row-span-2 h-full" />
        <GridTile src={imgs[1]} shortId={shortId} compact={compact} className="h-full" />
        <GridTile src={imgs[2]} shortId={shortId} compact={compact} className="h-full" />
      </MediaFrame>
    );
  }

  // Four or more: 2x2 grid, "+N" overlay on the last tile when there are extras.
  const tiles = imgs.slice(0, 4);
  const extra = imgs.length - 4;
  return (
    <MediaFrame
      className={cn("mt-3 grid grid-cols-2 grid-rows-2 gap-1 sm:mt-4", radius)}
      onDoubleLike={onDoubleLike}
    >
      {tiles.map((src, i) => (
        <GridTile
          key={i}
          src={src}
          shortId={shortId}
          compact={compact}
          className="aspect-square"
          overlay={i === 3 && extra > 0 ? `+${extra}` : undefined}
        />
      ))}
    </MediaFrame>
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

function GridTile({
  src,
  shortId,
  compact,
  className,
  overlay,
}: {
  src: string;
  shortId: string;
  compact?: boolean;
  className?: string;
  overlay?: string;
}) {
  const inner = (
    <>
      <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      {overlay ? (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-2xl font-semibold text-paper">
          {overlay}
        </span>
      ) : null}
    </>
  );
  const cls = cn("relative block overflow-hidden border border-bone bg-ink/[0.04]", className);
  if (compact) return <div className={cls}>{inner}</div>;
  return (
    <Link href={`/p/${shortId}`} className={cls}>
      {inner}
    </Link>
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
