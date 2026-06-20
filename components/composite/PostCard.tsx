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
  const [hidden, setHidden] = useState(false);
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

  function handleRepost() {
    startTransition(async () => {
      const res = await repostPostAction(post.id);
      if (res.ok) {
        setRepostToast(true);
        setTimeout(() => setRepostToast(false), 2500);
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
    if (onPin) runAction(() => onPin(post.id));
  }
  function handleUnpin() {
    if (onUnpin) runAction(() => onUnpin(post.id));
  }
  function handleDelete() {
    if (onDelete) runAction(() => onDelete(post.id));
  }
  function handleSaveHighlight() {
    if (onSaveHighlight) runAction(() => onSaveHighlight(post.id));
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
        Removed from your feed.
      </div>
    );
  }

  return (
    <article
      className={cn(
        "group relative border-b border-bone bg-paper transition-all duration-200",
        "hover:bg-cream/60",
        isPending && "opacity-70"
      )}
    >
      {/* Pinned badge */}
      {isPinned ? (
        <div className="flex items-center gap-1.5 px-5 pt-3 pb-0">
          <Pin className="size-3 text-ash" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-ash">Pinned</span>
        </div>
      ) : null}

      {/* Repost badge */}
      {isRepost ? (
        <div className="flex items-center gap-1.5 px-5 pt-3 pb-0">
          <Repeat2 className="size-3 text-ash" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-ash">Reposted</span>
        </div>
      ) : null}

      <div className="flex gap-3 px-5 py-5">
        {/* Avatar - links to profile */}
        <a
          href={post.author.handle ? `/u/${post.author.handle}` : "#"}
          className="shrink-0 mt-0.5"
          tabIndex={-1}
          aria-hidden="true"
        >
          <Avatar name={post.author.name} size="md" className="ring-2 ring-bone hover:ring-saffron/30 transition-all" />
        </a>

        <div className="min-w-0 flex-1">
          {/* Author row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
              <a
                href={post.author.handle ? `/u/${post.author.handle}` : "#"}
                className="text-sm font-semibold text-ink hover:text-saffron transition-colors truncate"
              >
                {post.author.name}
              </a>
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
                <div className="absolute right-0 top-8 z-50 min-w-44 rounded-xl border border-bone bg-paper py-1.5 shadow-xl shadow-ink/5">
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

          {/* Body (click opens the post, LinkedIn-style) */}
          <Link href={`/p/${post.short_id}`} className="block">
            <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink/90 whitespace-pre-line">
              {post.body}
            </p>
          </Link>

          {/* Tags */}
          {post.tags && post.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <Link key={t} href={`/t/${t}`}>
                  <Tag variant="saffron" className="text-[11px] hover:bg-saffron/20">
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
                className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </Link>
          ) : null}

          {/* Menu error */}
          {menuError ? (
            <p className="mt-2 text-xs text-ember">{menuError}</p>
          ) : null}

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-0 -ml-2">
            {/* Reaction control */}
            <div
              ref={reactionRef}
              className="relative"
              onMouseEnter={openReactionPopover}
              onMouseLeave={cancelReactionPopover}
            >
              {/* Reaction popover */}
              {reactionPopoverOpen ? (
                <div
                  className="absolute bottom-full left-0 mb-1.5 z-50 flex items-center gap-1 rounded-full border border-bone bg-paper px-2 py-1.5 shadow-xl shadow-ink/10"
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
                        "flex size-8 items-center justify-center rounded-full transition-all hover:scale-125",
                        r.color,
                        reaction === r.kind && "scale-125 bg-bone"
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
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
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
                      className="rounded-full p-1 text-ash transition-colors hover:text-ink disabled:opacity-40"
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
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
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
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
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
