"use client";

import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import {
  ThumbsUp,
  PartyPopper,
  HandHeart,
  Heart,
  Lightbulb,
  Laugh,
  MessageCircle,
  Bookmark,
  Repeat2,
  Share2,
  MoreHorizontal,
  Pin,
  PinOff,
  Star,
  Trash2,
  Flag,
} from "lucide-react";
import { useState, useRef, useEffect, useTransition } from "react";
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
import {
  markNotInterestedAction,
  markShowFewerLikeThisAction,
} from "@/app/(app)/home/feedback-actions";
import {
  deletePostAction,
  pinPostAction,
  unpinPostAction,
  saveHighlightAction,
} from "@/app/(app)/home/actions";
import type { ReactionKind } from "@/lib/db/engagement";

// ---------------------------------------------------------------------------
// Reaction config
// ---------------------------------------------------------------------------

type ReactionMeta = {
  kind: ReactionKind;
  label: string;
  icon: React.ReactNode;
  color: string;
};

const REACTIONS: ReactionMeta[] = [
  { kind: "like",       label: "Like",       icon: <ThumbsUp  className="size-4" />, color: "text-saffron" },
  { kind: "celebrate",  label: "Celebrate",  icon: <PartyPopper className="size-4" />, color: "text-amber-500" },
  { kind: "support",    label: "Support",    icon: <HandHeart className="size-4" />, color: "text-rose-400" },
  { kind: "love",       label: "Love",       icon: <Heart     className="size-4" />, color: "text-red-500" },
  { kind: "insightful", label: "Insightful", icon: <Lightbulb className="size-4" />, color: "text-blue-400" },
  { kind: "funny",      label: "Funny",      icon: <Laugh     className="size-4" />, color: "text-green-500" },
];

function getReactionMeta(kind?: string): ReactionMeta {
  return REACTIONS.find((r) => r.kind === kind) ?? REACTIONS[0];
}

/** The original post embedded inside a repost (LinkedIn-style nested card). */
export interface EmbeddedOriginal {
  short_id: string;
  author: { name: string; handle: string; college: string };
  time: string;
  body: string;
  tags?: string[];
  image?: string;
  stats: { likes: number; comments: number };
}

export interface Post {
  id: string;
  short_id: string;
  author_id: string;
  author: { name: string; handle: string; college: string };
  time: string;
  body: string;
  tags?: string[];
  image?: string;
  stats: { likes: number; comments: number; saves: number };
  variant?: "standard" | "project" | "news";
  is_pinned?: boolean;
  is_repost?: boolean;
  /**
   * For reposts: the original post embedded inside. Null when the original is
   * no longer available (deleted/expired).
   */
  repostOf?: EmbeddedOriginal | null;
  liked?: boolean;
  saved?: boolean;
  /** The viewer's current reaction kind, undefined if no reaction. */
  reaction?: string;
}

export interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onPin?: (postId: string) => Promise<{ ok: boolean; error?: string }>;
  onUnpin?: (postId: string) => Promise<{ ok: boolean; error?: string }>;
  onDelete?: (postId: string) => Promise<{ ok: boolean; error?: string }>;
  onSaveHighlight?: (postId: string) => Promise<{ ok: boolean; error?: string }>;
}

export function PostCard({
  post,
  currentUserId,
  onPin,
  onUnpin,
  onDelete,
  onSaveHighlight,
}: PostCardProps) {
  const [reaction, setReaction] = useState<string | undefined>(post.reaction);
  const [liked, setLiked] = useState(post.liked ?? false);
  const [saved, setSaved] = useState(post.saved ?? false);
  const [likes, setLikes] = useState(post.stats.likes);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [menuError, setMenuError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [repostToast, setRepostToast] = useState(false);
  const [highlightSaved, setHighlightSaved] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwner = Boolean(currentUserId) && currentUserId === post.author_id;
  const isPinned = post.is_pinned ?? false;
  const isRepost = post.is_repost ?? false;

  function toggleLike() {
    setReactionPopoverOpen(false);
    if (liked) {
      // Remove reaction
      const prevReaction = reaction;
      setLiked(false);
      setReaction(undefined);
      setLikes((c) => Math.max(0, c - 1));
      startTransition(async () => {
        const res = await unlikePostAction(post.id);
        if (!res.ok) {
          setLiked(true);
          setReaction(prevReaction);
          setLikes((c) => c + 1);
        }
      });
    } else {
      // Default to "like"
      setLiked(true);
      setReaction("like");
      setLikes((c) => c + 1);
      startTransition(async () => {
        const res = await likePostAction(post.id);
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
      const res = await reactToPostAction(post.id, kind);
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

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await (next ? bookmarkPostAction(post.id) : unbookmarkPostAction(post.id));
      if (!res.ok) setSaved(!next);
    });
  }

  async function handleShare() {
    const url = `${window.location.origin}/p/${post.short_id}`;
    // Prefer the OS share sheet (DMs, WhatsApp, etc.) when supported.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${post.author.name} on Collab47`, url });
        return;
      } catch {
        /* cancelled or unsupported — fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  function handleRepost() {
    setMenuError(null);
    // Repost the ORIGINAL post, never a repost-of-a-repost.
    const targetId = isRepost && post.repostOf ? undefined : post.id;
    if (targetId === undefined) {
      setMenuError("You can only repost an original post.");
      return;
    }
    startTransition(async () => {
      const res = await repostPostAction(targetId);
      if (res.ok) {
        setRepostToast(true);
        setTimeout(() => setRepostToast(false), 2500);
      } else {
        setMenuError(res.error ?? "Could not repost.");
      }
    });
  }

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

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

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMenuError(null);
    setMenuOpen(false);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setMenuError(result.error ?? "Action failed.");
      }
    });
  }

  function handlePin() {
    runAction(() => (onPin ? onPin(post.id) : pinPostAction(post.id)));
  }
  function handleUnpin() {
    runAction(() => (onUnpin ? onUnpin(post.id) : unpinPostAction(post.id)));
  }
  function handleDelete() {
    setMenuError(null);
    setMenuOpen(false);
    startTransition(async () => {
      const result = onDelete ? await onDelete(post.id) : await deletePostAction(post.id);
      if (result.ok) {
        setDeleted(true);
        setHidden(true);
      } else {
        setMenuError(result.error ?? "Could not delete post.");
      }
    });
  }
  function handleSaveHighlight() {
    setMenuError(null);
    setMenuOpen(false);
    startTransition(async () => {
      const result = onSaveHighlight
        ? await onSaveHighlight(post.id)
        : await saveHighlightAction(post.id);
      if (result.ok) {
        setHighlightSaved(true);
        setTimeout(() => setHighlightSaved(false), 2500);
      } else {
        setMenuError(result.error ?? "Could not save highlight.");
      }
    });
  }
  function handleNotInterested() {
    setMenuOpen(false);
    setHidden(true);
    startTransition(async () => {
      await markNotInterestedAction(post.id);
    });
  }
  function handleShowFewer() {
    setMenuOpen(false);
    const primary = post.tags?.[0];
    startTransition(async () => {
      await markShowFewerLikeThisAction(post.id, primary);
    });
  }

  if (hidden) {
    return (
      <div className="border-b border-bone py-4 px-5 text-sm text-ash italic">
        {deleted ? "Post deleted." : "Removed from your feed."}
      </div>
    );
  }

  return (
    <article
      data-feed-post={post.id}
      className={cn(
        "group relative border-b border-bone bg-paper transition-colors duration-200",
        "hover:bg-cream/60",
        isPinned && "bg-saffron/2",
        isPending && "opacity-70"
      )}
    >
      {/* Pinned badge */}
      {isPinned ? (
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 sm:px-5">
          <Pin className="size-3 text-saffron" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-saffron">Pinned</span>
        </div>
      ) : null}

      {/* Repost header: "{name} reposted" */}
      {isRepost ? (
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 sm:px-5">
          <Repeat2 className="size-3.5 text-ash" strokeWidth={1.75} />
          <span className="text-xs font-medium text-ash">
            <span className="text-ink/70">{post.author.name}</span> reposted
          </span>
        </div>
      ) : null}

      <div className="flex gap-3 px-4 py-5 sm:px-5">
        {/* Avatar - links to profile (plain span when no handle) */}
        {post.author.handle ? (
          <a
            href={`/u/${post.author.handle}`}
            className="shrink-0 mt-0.5"
            tabIndex={-1}
            aria-hidden="true"
          >
            <Avatar name={post.author.name} size="md" className="ring-2 ring-bone hover:ring-saffron/30 transition-all" />
          </a>
        ) : (
          <span className="shrink-0 mt-0.5" aria-hidden="true">
            <Avatar name={post.author.name} size="md" className="ring-2 ring-bone transition-all" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          {/* Author row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
              {post.author.handle ? (
                <a
                  href={`/u/${post.author.handle}`}
                  className="text-sm font-semibold text-ink hover:text-saffron transition-colors truncate"
                >
                  {post.author.name}
                </a>
              ) : (
                <span className="text-sm font-semibold text-ink truncate">{post.author.name}</span>
              )}
              {post.author.handle ? (
                <span className="text-xs text-ash truncate">@{post.author.handle}</span>
              ) : null}
              {post.author.college ? (
                <>
                  <span className="text-xs text-bone select-none">&middot;</span>
                  <span className="text-xs text-ash truncate">{post.author.college}</span>
                </>
              ) : null}
              <span className="text-xs text-bone select-none">&middot;</span>
              <span className="text-xs text-ash">{post.time}</span>
            </div>

            {/* 3-dot menu */}
            <div ref={menuRef} className="relative shrink-0 -mt-0.5">
              <button
                onClick={() => setMenuOpen((p) => !p)}
                disabled={isPending}
                aria-label="Post options"
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-ash",
                  "opacity-0 group-hover:opacity-100 transition-all",
                  "hover:bg-bone hover:text-ink disabled:opacity-30",
                  menuOpen && "opacity-100 bg-bone text-ink"
                )}
              >
                <MoreHorizontal className="size-4" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-8 z-50 min-w-44 origin-top-right rounded-xl border border-bone bg-paper py-1.5 shadow-xl shadow-ink/5">
                  {isOwner && !isPinned ? (
                    <MenuItem icon={<Pin className="size-4" />} label="Pin to portfolio" onClick={handlePin} />
                  ) : null}
                  {isOwner && isPinned ? (
                    <MenuItem icon={<PinOff className="size-4" />} label="Unpin" onClick={handleUnpin} />
                  ) : null}
                  {isOwner && isRepost ? (
                    <MenuItem icon={<Star className="size-4" />} label="Save as highlight" onClick={handleSaveHighlight} />
                  ) : null}
                  {isOwner ? (
                    <MenuItem icon={<Trash2 className="size-4" />} label="Delete" onClick={handleDelete} destructive />
                  ) : null}
                  <MenuDivider />
                  <MenuItem label="Not for me" onClick={handleNotInterested} />
                  <MenuItem label="Show fewer like this" onClick={handleShowFewer} />
                  <MenuItem icon={<Flag className="size-4" />} label="Report" onClick={() => { setMenuOpen(false); setReportOpen(true); }} />
                </div>
              ) : null}
            </div>
          </div>

          {/* Reposter's own added body (optional thought above the original) */}
          {post.body ? (
            <Link href={`/p/${post.short_id}`} className="block">
              <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink/90 whitespace-pre-line wrap-break-word">
                {post.body}
              </p>
            </Link>
          ) : null}

          {isRepost ? (
            /* Embedded ORIGINAL post (LinkedIn-style nested card) */
            <div className="mt-3">
              <EmbeddedOriginalCard original={post.repostOf} />
            </div>
          ) : (
            <>
              {/* Tags */}
              {post.tags && post.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {post.tags.map((t) => (
                    <Link key={t} href={`/t/${t}`}>
                      <Tag variant="saffron" className="text-[11px] transition-colors hover:bg-saffron/20">
                        #{t}
                      </Tag>
                    </Link>
                  ))}
                </div>
              ) : null}

              {/* Image (click opens the post) */}
              {post.image ? (
                <Link
                  href={`/p/${post.short_id}`}
                  className="mt-4 block aspect-video w-full overflow-hidden rounded-xl border border-bone bg-bone/40"
                >
                  <img
                    src={post.image}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                </Link>
              ) : null}
            </>
          )}

          {/* Menu error / highlight confirmation */}
          {menuError ? (
            <p className="mt-2 text-xs text-ember">{menuError}</p>
          ) : highlightSaved ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-moss">
              <Star className="size-3.5 fill-moss" />
              Saved as a highlight.
            </p>
          ) : null}

          {/* Action bar */}
          <div className="mt-4 -ml-2 flex items-center justify-between sm:justify-start sm:gap-1">
            {/* Reaction control */}
            <div
              ref={reactionRef}
              className="relative"
              onMouseEnter={openReactionPopover}
              onMouseLeave={cancelReactionPopover}
            >
              {/* Reaction popover — left-anchored but clamped so it never spills
                  past the viewport edge on phones. */}
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
                        "flex size-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-125 active:scale-110 sm:size-8",
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
              {(() => {
                const meta = getReactionMeta(liked ? reaction : undefined);
                return (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={toggleLike}
                      disabled={isPending}
                      aria-label={liked ? `Remove ${meta.label}` : "Like"}
                      className={cn(
                        "flex min-h-10 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium sm:px-3",
                        "text-ash transition-all duration-150",
                        "hover:bg-bone hover:text-ink active:scale-95",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        liked && meta.color
                      )}
                    >
                      {liked ? (
                        <span className={cn("size-4 transition-all scale-110", meta.color)}>
                          {meta.icon}
                        </span>
                      ) : (
                        <ThumbsUp className="size-4 transition-all stroke-current" />
                      )}
                      {likes > 0 ? (
                        <span className="tabular-nums text-xs">{likes}</span>
                      ) : null}
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
                );
              })()}
            </div>

            {/* Comment - links to full post thread */}
            <Link
              href={`/p/${post.short_id}`}
              aria-label={`${post.stats.comments} comments`}
              className={cn(
                "flex min-h-10 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium sm:px-3",
                "text-ash transition-all duration-150",
                "hover:bg-bone hover:text-ink active:scale-95"
              )}
            >
              <MessageCircle className="size-4" />
              {post.stats.comments > 0 ? (
                <span className="tabular-nums text-xs">{post.stats.comments}</span>
              ) : null}
            </Link>

            {/* Repost */}
            <ActionBtn
              onClick={handleRepost}
              disabled={isPending}
              label="Repost"
              activeClass="text-moss"
              active={repostToast}
              icon={
                <Repeat2
                  className={cn(
                    "size-4 transition-all",
                    repostToast && "text-moss scale-110"
                  )}
                />
              }
              extraContent={
                repostToast ? (
                  <span className="ml-1 text-[11px] text-moss font-medium">Reposted</span>
                ) : null
              }
            />

            {/* Save */}
            <ActionBtn
              onClick={toggleSave}
              active={saved}
              activeClass="text-saffron"
              label={saved ? "Saved" : "Save"}
              icon={
                <Bookmark
                  className={cn(
                    "size-4 transition-all",
                    saved ? "fill-saffron stroke-saffron scale-110" : "stroke-current"
                  )}
                />
              }
            />

            {/* Share */}
            <ActionBtn
              onClick={handleShare}
              active={shareCopied}
              activeClass="text-moss"
              label={shareCopied ? "Link copied" : "Share"}
              icon={<Share2 className="size-4 transition-all" />}
              extraContent={
                shareCopied ? (
                  <span className="ml-1 text-[11px] text-moss font-medium">Copied</span>
                ) : null
              }
            />
          </div>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        onSubmit={submitReportAction}
      />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Embedded original (the reposted post, nested LinkedIn-style)
// ---------------------------------------------------------------------------

function EmbeddedOriginalCard({ original }: { original?: EmbeddedOriginal | null }) {
  if (!original) {
    return (
      <div className="rounded-xl border border-bone bg-cream/40 p-4 text-sm text-ash italic">
        Original post is no longer available.
      </div>
    );
  }

  return (
    <Link
      href={`/p/${original.short_id}`}
      className="block rounded-xl border border-bone bg-cream/40 p-4 transition-colors hover:border-saffron/40"
    >
      {/* Original author row */}
      <div className="flex items-center gap-2.5">
        <Avatar name={original.author.name} size="sm" className="shrink-0 ring-1 ring-bone" />
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
          <span className="text-sm font-semibold text-ink truncate">{original.author.name}</span>
          {original.author.handle ? (
            <span className="text-xs text-ash truncate">@{original.author.handle}</span>
          ) : null}
          {original.author.college ? (
            <>
              <span className="text-xs text-bone select-none">&middot;</span>
              <span className="text-xs text-ash truncate">{original.author.college}</span>
            </>
          ) : null}
          <span className="text-xs text-bone select-none">&middot;</span>
          <span className="text-xs text-ash">{original.time}</span>
        </div>
      </div>

      {/* Original body */}
      {original.body ? (
        <p className="mt-2.5 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-ink/90">
          {original.body}
        </p>
      ) : null}

      {/* Original hashtags */}
      {original.tags && original.tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {original.tags.map((t) => (
            <Tag key={t} variant="saffron" className="text-[11px]">
              #{t}
            </Tag>
          ))}
        </div>
      ) : null}

      {/* Original image */}
      {original.image ? (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-bone bg-bone/40">
          <img src={original.image} alt="" loading="lazy" className="size-full object-cover" />
        </div>
      ) : null}

      {/* Original engagement counts */}
      {(original.stats.likes > 0 || original.stats.comments > 0) ? (
        <div className="mt-3 flex items-center gap-4 text-xs text-ash">
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="size-3.5" strokeWidth={1.75} />
            {original.stats.likes.toLocaleString("en-IN")}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-3.5" strokeWidth={1.75} />
            {original.stats.comments.toLocaleString("en-IN")}
          </span>
        </div>
      ) : null}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Action button - unified pill-style with hover background
// ---------------------------------------------------------------------------

function ActionBtn({
  onClick,
  disabled,
  icon,
  count,
  label,
  active = false,
  activeClass = "",
  extraContent,
}: {
  onClick?: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  count?: number;
  label: string;
  active?: boolean;
  activeClass?: string;
  extraContent?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex min-h-10 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium sm:px-3",
        "text-ash transition-all duration-150",
        "hover:bg-bone hover:text-ink active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active && activeClass
      )}
    >
      {icon}
      {count !== undefined && count > 0 ? (
        <span className="tabular-nums text-xs">{count}</span>
      ) : null}
      {extraContent}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Menu primitives
// ---------------------------------------------------------------------------

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-bone",
        destructive ? "text-ember" : "text-ink"
      )}
    >
      {icon ? <span className="shrink-0 opacity-70">{icon}</span> : null}
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-bone" />;
}
