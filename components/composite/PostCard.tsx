"use client";

import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Pin, PinOff, Star, Trash2, Flag } from "lucide-react";
import { useState, useRef, useEffect, useTransition } from "react";
import { cn } from "@/lib/cn";
import { ReportModal } from "./ReportModal";
import { submitReportAction } from "@/app/(app)/home/report-actions";
import { likePostAction, unlikePostAction, bookmarkPostAction, unbookmarkPostAction, repostPostAction } from "@/app/(app)/home/engagement-actions";
import { markNotInterestedAction, markShowFewerLikeThisAction } from "@/app/(app)/home/feedback-actions";

export interface Post {
  id: string;
  author: { name: string; handle: string; college: string };
  time: string;
  body: string;
  tags?: string[];
  image?: string;
  stats: { likes: number; comments: number; saves: number };
  variant?: "standard" | "project" | "news";
  is_pinned?: boolean;
  is_repost?: boolean;
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
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(post.stats.likes);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [menuError, setMenuError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [repostToast, setRepostToast] = useState(false);
  const [hidden, setHidden] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Derive ownership: post.id is the post id; currentUserId check is done via prop.
  // In real data the post would have author_id; here we derive owner from prop presence.
  const isOwner = Boolean(currentUserId);
  const isPinned = post.is_pinned ?? false;
  const isRepost = post.is_repost ?? false;

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikes((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      const res = await (next ? likePostAction(post.id) : unlikePostAction(post.id));
      if (!res.ok) {
        // rollback on failure
        setLiked(!next);
        setLikes((c) => c + (next ? -1 : 1));
      }
    });
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

  // Close menu on outside click
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
      <div className="border-b border-bone py-4 text-sm text-ash">
        Removed from your feed.
      </div>
    );
  }

  return (
    <article className="border-b border-bone py-6 transition-colors hover:bg-paper">
      <div className="flex items-start gap-3">
        <Avatar name={post.author.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-ink">
              {post.author.name}
            </p>
            <p className="text-xs text-ash">
              @{post.author.handle} . {post.author.college}
            </p>
          </div>
          <p className="text-xs text-ash">{post.time}</p>
          <p className="mt-3 text-body text-ink">{post.body}</p>

          {post.tags && post.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <Tag key={t} variant="outline">
                  #{t}
                </Tag>
              ))}
            </div>
          ) : null}

          {post.image ? (
            <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg bg-bone">
              <img
                src={post.image}
                alt=""
                className="size-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
          ) : null}

          {menuError ? (
            <p className="mt-2 text-xs text-ember">{menuError}</p>
          ) : null}

          <div className="mt-4 flex items-center gap-6 text-sm text-ash">
            <button
              onClick={toggleLike}
              className={cn(
                "flex items-center gap-1.5 transition-colors hover:text-saffron",
                liked && "text-saffron"
              )}
            >
              <Heart className={cn("size-4", liked && "fill-saffron")} />
              {likes}
            </button>
            <button className="flex items-center gap-1.5 transition-colors hover:text-ink">
              <MessageCircle className="size-4" />
              {post.stats.comments}
            </button>
            <button
              onClick={toggleSave}
              className={cn(
                "flex items-center gap-1.5 transition-colors hover:text-ink",
                saved && "text-ink"
              )}
            >
              <Bookmark className={cn("size-4", saved && "fill-ink")} />
            </button>
            <button
              onClick={handleRepost}
              disabled={isPending}
              className="flex items-center gap-1.5 transition-colors hover:text-saffron disabled:opacity-50"
              aria-label="Repost"
            >
              <Share2 className="size-4" />
              {repostToast ? <span className="text-xs text-saffron">Reposted, expires in 24h</span> : null}
            </button>

            {/* 3-dot menu */}
            <div ref={menuRef} className="relative ml-auto">
              <button
                onClick={() => setMenuOpen((p) => !p)}
                disabled={isPending}
                className="transition-colors hover:text-ink disabled:opacity-50"
                aria-label="Post options"
              >
                <MoreHorizontal className="size-4" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-6 z-50 min-w-45 rounded-lg border border-bone bg-paper py-1 shadow-lg">
                  {/* Owner actions */}
                  {isOwner && !isPinned ? (
                    <MenuItem
                      icon={<Pin className="size-4" />}
                      label="Pin to portfolio"
                      onClick={handlePin}
                    />
                  ) : null}
                  {isOwner && isPinned ? (
                    <MenuItem
                      icon={<PinOff className="size-4" />}
                      label="Unpin"
                      onClick={handleUnpin}
                    />
                  ) : null}
                  {isOwner && isRepost ? (
                    <MenuItem
                      icon={<Star className="size-4" />}
                      label="Save as highlight"
                      onClick={handleSaveHighlight}
                    />
                  ) : null}
                  {isOwner ? (
                    <MenuItem
                      icon={<Trash2 className="size-4" />}
                      label="Delete"
                      onClick={handleDelete}
                      destructive
                    />
                  ) : null}

                  {/* Universal actions */}
                  <MenuDivider />
                  <MenuItem label="Not for me" onClick={handleNotInterested} />
                  <MenuItem label="Show fewer like this" onClick={handleShowFewer} />
                  <MenuItem
                    icon={<Flag className="size-4" />}
                    label="Report"
                    onClick={() => {
                      setMenuOpen(false);
                      setReportOpen(true);
                    }}
                  />
                </div>
              ) : null}
            </div>
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
// Internal menu primitives
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
