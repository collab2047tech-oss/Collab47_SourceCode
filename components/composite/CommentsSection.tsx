"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { Send, ChevronDown, ChevronUp, Heart } from "lucide-react";
import type { CommentWithAuthor } from "@/lib/db/posts";
import { addCommentOnPostAction } from "@/app/p/[short_id]/actions";
import { likeCommentAction, unlikeCommentAction } from "@/app/p/[short_id]/comment-like-actions";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface InitialLikes {
  counts: Record<string, number>;
  liked: string[];
}

interface Props {
  postId: string;
  initialComments: CommentWithAuthor[];
  initialLikes?: InitialLikes;
  currentUserName?: string;
}

export function CommentsSection({ postId, initialComments, initialLikes, currentUserName = "You" }: Props) {
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(initialLikes?.counts ?? {});
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set(initialLikes?.liked ?? []));
  // replyTo.id is always the TOP-LEVEL ancestor (1-level threading, YouTube-style);
  // replyTo.name is the person being replied to (for the @mention + label).
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Start a reply that flattens onto the given top-level ancestor. */
  function startReply(topLevelId: string, name: string) {
    setReplyTo({ id: topLevelId, name });
    setExpanded((prev) => new Set(prev).add(topLevelId));
    setBody((b) => {
      const mention = `@${name} `;
      return b.startsWith("@") ? b : mention;
    });
  }

  function toggleLike(commentId: string) {
    // Optimistic devices are not available for not-yet-persisted optimistic comments.
    if (commentId.startsWith("optimistic-")) return;
    const isLiked = likedSet.has(commentId);
    // Optimistic update
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] ?? 0) + (isLiked ? -1 : 1)),
    }));

    startTransition(async () => {
      const res = isLiked
        ? await unlikeCommentAction(commentId)
        : await likeCommentAction(commentId);
      if (!res.ok) {
        // Roll back
        setLikedSet((prev) => {
          const next = new Set(prev);
          if (isLiked) next.add(commentId);
          else next.delete(commentId);
          return next;
        });
        setLikeCounts((prev) => ({
          ...prev,
          [commentId]: Math.max(0, (prev[commentId] ?? 0) + (isLiked ? 1 : -1)),
        }));
      }
    });
  }

  function LikeButton({ commentId, size = "sm" }: { commentId: string; size?: "sm" | "xs" }) {
    const liked = likedSet.has(commentId);
    const count = likeCounts[commentId] ?? 0;
    return (
      <button
        type="button"
        onClick={() => toggleLike(commentId)}
        aria-pressed={liked}
        aria-label={liked ? "Unlike comment" : "Like comment"}
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors",
          size === "sm" ? "text-xs" : "text-[11px]",
          liked ? "text-ember" : "text-ash hover:text-ink"
        )}
      >
        <Heart className={cn(size === "sm" ? "size-3.5" : "size-3", liked && "fill-current")} />
        {count > 0 ? <span className="tabular-nums">{count}</span> : null}
      </button>
    );
  }

  const tops = comments.filter((c) => !c.parent_comment_id);
  const repliesMap = new Map<string, CommentWithAuthor[]>();
  for (const c of comments) {
    if (c.parent_comment_id) {
      const arr = repliesMap.get(c.parent_comment_id) ?? [];
      arr.push(c);
      repliesMap.set(c.parent_comment_id, arr);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);

    const optimistic: CommentWithAuthor = {
      id: `optimistic-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      parent_comment_id: replyTo?.id ?? null,
      author: { handle: "", name: currentUserName, avatar_url: null },
    };
    setComments((prev) => [...prev, optimistic]);
    if (replyTo) setExpanded((prev) => new Set(prev).add(replyTo.id));
    setBody("");
    setReplyTo(null);

    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("body", text);
    if (replyTo) fd.set("parentCommentId", replyTo.id);

    startTransition(async () => {
      const res = await addCommentOnPostAction(fd);
      if (!res.ok && "error" in res) {
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
        setError(res.error ?? "Could not post comment.");
      }
    });
  }

  return (
    <section className="mt-10 border-t border-bone pt-6">
      <p className="mb-4 text-caption">Comments</p>

      {/* Comment list */}
      <ul className="divide-y divide-bone">
        {tops.length === 0 ? (
          <li className="py-4 text-center text-xs text-ash">No comments yet. Be first.</li>
        ) : (
          tops.map((c) => {
            const replies = repliesMap.get(c.id) ?? [];
            const isExpanded = expanded.has(c.id);
            return (
              <li key={c.id} className="py-4">
                <article className="flex items-start gap-3">
                  <Avatar name={c.author.name} src={c.author.avatar_url ?? undefined} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-ink">{c.author.name}</span>
                      {c.author.handle ? (
                        <span className="text-xs text-ash">@{c.author.handle}</span>
                      ) : null}
                      <span className="text-xs text-ash">{relativeTime(c.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink">{c.body}</p>
                    <div className="mt-1.5 flex items-center gap-4">
                      <LikeButton commentId={c.id} size="sm" />
                      <button
                        type="button"
                        onClick={() => startReply(c.id, c.author.name)}
                        className="text-xs font-medium text-ash hover:text-ink transition-colors"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </article>

                {/* View / Hide replies toggle */}
                {replies.length > 0 ? (
                  <div className="ml-11 mt-2">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(c.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-saffron hover:text-saffron-dk transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="size-3.5" />
                          Hide replies
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3.5" />
                          {replies.length} {replies.length === 1 ? "reply" : "replies"}
                        </>
                      )}
                    </button>
                  </div>
                ) : null}

                {/* Replies (flattened to 1 level) */}
                {replies.length > 0 && isExpanded ? (
                  <ul className="ml-5 mt-3 space-y-3 border-l-2 border-bone pl-5">
                    {replies.map((r) => (
                      <li key={r.id}>
                        <article className="flex items-start gap-2.5">
                          <Avatar name={r.author.name} src={r.author.avatar_url ?? undefined} size="xs" />
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-ink">{r.author.name}</span>
                              {r.author.handle ? (
                                <span className="text-[11px] text-ash">@{r.author.handle}</span>
                              ) : null}
                              <span className="text-[11px] text-ash">{relativeTime(r.created_at)}</span>
                            </div>
                            <p className="mt-0.5 text-sm leading-relaxed text-ink">{r.body}</p>
                            <div className="mt-1 flex items-center gap-3">
                              <LikeButton commentId={r.id} size="xs" />
                              <button
                                type="button"
                                onClick={() => startReply(c.id, r.author.name)}
                                className="text-[11px] font-medium text-ash hover:text-ink transition-colors"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </article>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      {/* Composer */}
      <form onSubmit={submit} className="mt-4 flex items-start gap-3">
        <Avatar name={currentUserName} size="sm" />
        <div className="flex flex-1 flex-col gap-2">
          {replyTo ? (
            <div className="flex items-center gap-2 text-xs text-ash">
              <span>Replying to <strong className="text-ink">{replyTo.name}</strong></span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-ember hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 600))}
              rows={1}
              placeholder={replyTo ? `Reply to ${replyTo.name}` : "Add a comment"}
              className="min-h-9 flex-1 resize-none rounded-md border border-bone bg-cream px-3 py-2 text-sm text-ink placeholder:text-ash focus:border-ink focus:outline-none"
            />
            <button
              type="submit"
              disabled={isPending || !body.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-saffron px-4 text-sm text-cream transition-colors hover:bg-saffron/90 disabled:opacity-50"
            >
              <Send className="size-3.5" />
              {isPending ? "..." : "Send"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            {error ? <span className="text-xs text-ember">{error}</span> : <span />}
            <span className="text-caption">{body.length}/600</span>
          </div>
        </div>
      </form>
    </section>
  );
}
