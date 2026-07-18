"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  ThumbsUp,
  PartyPopper,
  HandHeart,
  Heart,
  Lightbulb,
  Laugh,
  Bookmark,
  Share2,
  MessageCircle,
  Repeat2,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportModal } from "./ReportModal";
import { submitReportAction } from "@/app/(app)/home/report-actions";
import {
  likePostAction,
  unlikePostAction,
  reactToPostAction,
  bookmarkPostAction,
  unbookmarkPostAction,
  repostPostAction,
} from "@/app/(app)/home/engagement-actions";
import type { ReactionKind } from "@/lib/db/engagement";

type ReactionMeta = {
  kind: ReactionKind;
  label: string;
  icon: React.ReactNode;
  color: string;
};

// Locked Collab47 palette only (no raw Tailwind amber/rose/red/blue/green). The
// icon shape carries the meaning; colors are drawn from the token set so this
// bar is one visual system with PostCard's action bar.
const REACTIONS: ReactionMeta[] = [
  { kind: "like",       label: "Like",       icon: <ThumbsUp    className="size-4" />, color: "text-saffron" },
  { kind: "celebrate",  label: "Celebrate",  icon: <PartyPopper className="size-4" />, color: "text-moss" },
  { kind: "support",    label: "Support",    icon: <HandHeart   className="size-4" />, color: "text-navy" },
  { kind: "love",       label: "Love",       icon: <Heart       className="size-4" />, color: "text-ember" },
  { kind: "insightful", label: "Insightful", icon: <Lightbulb   className="size-4" />, color: "text-navy" },
  { kind: "funny",      label: "Funny",      icon: <Laugh       className="size-4" />, color: "text-saffron" },
];

function getReactionMeta(kind?: string): ReactionMeta {
  return REACTIONS.find((r) => r.kind === kind) ?? REACTIONS[0];
}

interface Props {
  postId: string;
  initialLiked: boolean;
  initialSaved: boolean;
  initialReaction?: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  shortId: string;
}

export function PostDetailActions({
  postId,
  initialLiked,
  initialSaved,
  initialReaction,
  likeCount,
  commentCount,
  bookmarkCount,
  shortId,
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [reaction, setReaction] = useState<string | undefined>(initialReaction);
  const [saved, setSaved] = useState(initialSaved);
  const [saves, setSaves] = useState(bookmarkCount);
  const [likes, setLikes] = useState(likeCount);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [repostToast, setRepostToast] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!reactionPopoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) {
        setReactionPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [reactionPopoverOpen]);

  function toggleLike() {
    setReactionPopoverOpen(false);
    if (liked) {
      const prevReaction = reaction;
      setLiked(false);
      setReaction(undefined);
      setLikes((c) => Math.max(0, c - 1));
      startTransition(async () => {
        const res = await unlikePostAction(postId);
        if (!res.ok) {
          setLiked(true);
          setReaction(prevReaction);
          setLikes((c) => c + 1);
        }
      });
    } else {
      setLiked(true);
      setReaction("like");
      setLikes((c) => c + 1);
      startTransition(async () => {
        const res = await likePostAction(postId);
        if (!res.ok) {
          setLiked(false);
          setReaction(undefined);
          setLikes((c) => Math.max(0, c - 1));
        }
      });
    }
  }

  function pickReaction(kind: ReactionKind) {
    setReactionPopoverOpen(false);
    const prevLiked = liked;
    const prevReaction = reaction;
    const prevLikes = likes;
    const delta = liked ? 0 : 1;
    setLiked(true);
    setReaction(kind);
    setLikes((c) => c + delta);
    startTransition(async () => {
      const res = await reactToPostAction(postId, kind);
      if (!res.ok) {
        setLiked(prevLiked);
        setReaction(prevReaction);
        setLikes(prevLikes);
      }
    });
  }

  function openReactionPopover() {
    hoverTimerRef.current = setTimeout(() => setReactionPopoverOpen(true), 120);
  }

  function cancelReactionPopover() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }

  function handleRepost() {
    setActionError(null);
    if (reposted) return;
    // Optimistic: flip to reposted + show the toast instantly; roll back on failure.
    setReposted(true);
    setRepostToast(true);
    startTransition(async () => {
      const res = await repostPostAction(postId);
      if (res.ok) {
        setTimeout(() => setRepostToast(false), 2500);
      } else {
        setReposted(false);
        setRepostToast(false);
        setActionError(res.error ?? "Could not repost.");
      }
    });
  }

  function toggleSave() {
    const next = !saved;
    // Optimistic: flip the icon AND bump the count instantly; roll both back on
    // failure (matches the feed PostCard save pattern).
    setSaved(next);
    setSaves((c) => Math.max(0, next ? c + 1 : c - 1));
    startTransition(async () => {
      const res = await (next ? bookmarkPostAction(postId) : unbookmarkPostAction(postId));
      if (!res.ok) {
        setSaved(!next);
        setSaves((c) => Math.max(0, next ? c - 1 : c + 1));
      }
    });
  }

  async function handleShare() {
    const url = `${window.location.origin}/p/${shortId}`;
    // Prefer the OS share sheet (DMs, WhatsApp, etc.) when supported.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Post on Collab47", url });
        return;
      } catch {
        /* cancelled or unsupported - fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  const meta = getReactionMeta(liked ? reaction : undefined);

  return (
    <div className="mt-10 border-t border-bone pt-6">
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ash sm:gap-6", isPending && "opacity-70")}>
      {/* Reaction control */}
      <div
        ref={reactionRef}
        className="relative"
        onMouseEnter={openReactionPopover}
        onMouseLeave={cancelReactionPopover}
      >
        {/* Reaction popover - clamped so it never spills past the viewport edge. */}
        {reactionPopoverOpen ? (
          <div
            className="absolute bottom-full left-0 z-50 mb-1.5 flex max-w-[calc(100vw-2rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-bone bg-paper px-2 py-1.5 shadow-xl shadow-ink/10 sm:gap-1 sm:overflow-visible"
            onMouseEnter={() => {
              cancelReactionPopover();
              setReactionPopoverOpen(true);
            }}
            onMouseLeave={() => setReactionPopoverOpen(false)}
          >
            {REACTIONS.map((r) => (
              <button
                key={r.kind}
                type="button"
                onClick={() => pickReaction(r.kind)}
                aria-label={r.label}
                title={r.label}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-125 active:scale-110",
                  r.color,
                  reaction === r.kind && "scale-110 bg-bone"
                )}
              >
                {r.icon}
              </button>
            ))}
          </div>
        ) : null}

        {/* Main reaction button */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleLike}
            disabled={isPending}
            aria-label={liked ? `Remove ${meta.label}` : "Like"}
            className={cn(
              "flex min-h-10 items-center gap-1.5 transition-colors hover:text-saffron active:scale-95 disabled:opacity-40",
              liked ? meta.color : ""
            )}
          >
            {liked ? (
              <span className={cn("size-4 transition-all scale-110", meta.color)}>
                {meta.icon}
              </span>
            ) : (
              <ThumbsUp className="size-4 stroke-current" />
            )}
            {likes}
          </button>
          {/* Caret: click opens the reaction picker instantly (touch-friendly) */}
          <button
            type="button"
            onClick={() => {
              cancelReactionPopover();
              setReactionPopoverOpen((o) => !o);
            }}
            disabled={isPending}
            aria-label="Choose a reaction"
            className="flex min-h-10 items-center rounded-full px-1.5 text-ash transition-colors hover:text-ink disabled:opacity-40"
          >
            <span className="block size-0 border-x-[3px] border-t-4 border-x-transparent border-t-current" />
          </button>
        </div>
      </div>

      {/* Comment count (static display - thread is below) */}
      <span className="flex min-h-10 items-center gap-1.5 text-ash">
        <MessageCircle className="size-4" />
        {commentCount}
      </span>

      {/* Bookmark */}
      <button
        type="button"
        onClick={toggleSave}
        disabled={isPending}
        aria-label={saved ? "Remove bookmark" : "Bookmark"}
        className={cn(
          "flex min-h-10 items-center gap-1.5 transition-colors hover:text-ink active:scale-95 disabled:opacity-40",
          saved && "text-saffron"
        )}
      >
        <Bookmark
          className={cn("size-4 transition-all", saved ? "fill-saffron stroke-saffron scale-110" : "stroke-current")}
        />
        {saves}
      </button>

      {/* Repost */}
      <button
        type="button"
        onClick={handleRepost}
        disabled={isPending}
        aria-label="Repost"
        aria-pressed={reposted}
        className={cn(
          "flex min-h-10 items-center gap-1.5 transition-colors hover:text-ink active:scale-95 disabled:opacity-40",
          reposted && "text-moss"
        )}
      >
        <Repeat2 className={cn("size-4 transition-all", reposted && "scale-110")} />
        {repostToast ? <span className="text-xs font-medium text-moss">Reposted</span> : null}
      </button>

      {/* Share */}
      <button
        type="button"
        onClick={handleShare}
        aria-label="Copy link"
        className="flex min-h-10 items-center gap-1.5 transition-colors hover:text-ink active:scale-95"
      >
        <Share2 className="size-4" />
        {copied ? <span className="text-xs font-medium text-moss">Copied!</span> : null}
      </button>

      {/* Report - pushed to the far end of the row */}
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        aria-label="Report this post"
        className="flex min-h-10 items-center gap-1.5 transition-colors hover:text-ember active:scale-95 sm:ml-auto"
      >
        <Flag className="size-4" />
      </button>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={postId}
        onSubmit={submitReportAction}
      />
    </div>
    {actionError ? <p className="mt-3 text-xs text-ember">{actionError}</p> : null}
    </div>
  );
}
