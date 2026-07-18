"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { cn } from "@/lib/cn";
import { Send, ChevronDown, ChevronUp, Heart, Trash2 } from "lucide-react";
import type { CommentWithAuthor } from "@/lib/db/posts";
import { addCommentOnPostAction, deleteCommentOnPostAction } from "@/app/p/[short_id]/actions";
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
  currentUserId?: string;
  currentUserName?: string;
  /**
   * "page"  -> stacked full-page thread (default).
   * "modal" -> comments rail: on desktop the list scrolls independently and the
   *            composer is pinned at the bottom of the rail.
   */
  variant?: "page" | "modal";
}

export function CommentsSection({
  postId,
  initialComments,
  initialLikes,
  currentUserId = "",
  currentUserName = "You",
  variant = "page",
}: Props) {
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

  function deleteComment(commentId: string) {
    // Not-yet-persisted optimistic comments can't be server-deleted.
    if (commentId.startsWith("optimistic-")) return;
    const snapshot = comments;
    // Optimistically remove the comment (and any of its replies).
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId));
    startTransition(async () => {
      const res = await deleteCommentOnPostAction(commentId);
      if (!res.ok) {
        // Roll back to the pre-delete snapshot and surface the error.
        setComments(snapshot);
        if ("error" in res) setError(res.error ?? "Could not delete comment.");
      }
    });
  }

  function DeleteButton({ commentId, size = "sm" }: { commentId: string; size?: "sm" | "xs" }) {
    return (
      <button
        type="button"
        onClick={() => deleteComment(commentId)}
        aria-label="Delete comment"
        className={cn(
          "inline-flex items-center gap-1 font-medium text-ash transition-colors hover:text-ember",
          size === "sm" ? "text-xs" : "text-[11px]"
        )}
      >
        <Trash2 className={size === "sm" ? "size-3.5" : "size-3"} />
        Delete
      </button>
    );
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
    if (isPending) return;
    const text = body.trim();
    if (!text) return;
    setError(null);

    // Capture the reply context for this submission (state may change).
    const submittingReplyTo = replyTo;

    const optimistic: CommentWithAuthor = {
      id: `optimistic-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      parent_comment_id: submittingReplyTo?.id ?? null,
      author_id: currentUserId,
      author: { handle: "", name: currentUserName, avatar_url: null },
    };
    // Optimistically show the comment immediately (marked "sending" via its id).
    setComments((prev) => [...prev, optimistic]);
    if (submittingReplyTo) setExpanded((prev) => new Set(prev).add(submittingReplyTo.id));
    // P0: DO NOT clear the composer yet. The typed text stays put (composer is
    // disabled via isPending) so a failed submit never loses it. We only clear
    // on confirmed success, and restore + surface an error on failure.

    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("body", text);
    if (submittingReplyTo) fd.set("parentCommentId", submittingReplyTo.id);

    startTransition(async () => {
      const res = await addCommentOnPostAction(fd);
      if (res.ok) {
        // Success: the comment is confirmed - now it is safe to clear the input.
        setBody("");
        setReplyTo(null);
      } else {
        // Failure: roll back the optimistic comment, keep the typed text intact
        // for an immediate retry, and show an inline error.
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
        setError(("error" in res && res.error) ? res.error : "Could not post comment. Try again.");
      }
    });
  }

  const listEl = (
    <ul className="divide-y divide-bone">
      {tops.length === 0 ? (
        <li className="py-4 text-center text-xs text-ash">No comments yet. Be first.</li>
      ) : (
        tops.map((c) => {
          const replies = repliesMap.get(c.id) ?? [];
          const isExpanded = expanded.has(c.id);
          const isSending = c.id.startsWith("optimistic-");
          return (
            <li key={c.id} className="py-4">
              <article className={cn("flex items-start gap-3", isSending && "opacity-60")}>
                <Avatar name={c.author.name} src={c.author.avatar_url ?? undefined} size="sm" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-ink">{c.author.name}</span>
                    {c.author.handle ? (
                      <span className="text-xs text-ash">@{c.author.handle}</span>
                    ) : null}
                    <span className="text-xs text-ash">
                      {isSending ? "Sending…" : relativeTime(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{c.body}</p>
                  {!isSending ? (
                    <div className="mt-1.5 flex items-center gap-4">
                      <LikeButton commentId={c.id} size="sm" />
                      <button
                        type="button"
                        onClick={() => startReply(c.id, c.author.name)}
                        className="text-xs font-medium text-ash hover:text-ink transition-colors"
                      >
                        Reply
                      </button>
                      {currentUserId && c.author_id === currentUserId ? (
                        <DeleteButton commentId={c.id} size="sm" />
                      ) : null}
                    </div>
                  ) : null}
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
                  {replies.map((r) => {
                    const rSending = r.id.startsWith("optimistic-");
                    return (
                      <li key={r.id}>
                        <article className={cn("flex items-start gap-2.5", rSending && "opacity-60")}>
                          <Avatar name={r.author.name} src={r.author.avatar_url ?? undefined} size="xs" />
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-ink">{r.author.name}</span>
                              {r.author.handle ? (
                                <span className="text-[11px] text-ash">@{r.author.handle}</span>
                              ) : null}
                              <span className="text-[11px] text-ash">
                                {rSending ? "Sending…" : relativeTime(r.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm leading-relaxed text-ink">{r.body}</p>
                            {!rSending ? (
                              <div className="mt-1 flex items-center gap-3">
                                <LikeButton commentId={r.id} size="xs" />
                                <button
                                  type="button"
                                  onClick={() => startReply(c.id, r.author.name)}
                                  className="text-[11px] font-medium text-ash hover:text-ink transition-colors"
                                >
                                  Reply
                                </button>
                                {currentUserId && r.author_id === currentUserId ? (
                                  <DeleteButton commentId={r.id} size="xs" />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })
      )}
    </ul>
  );

  const composerEl = (
    <form onSubmit={submit} className="flex items-start gap-3">
      <Avatar name={currentUserName} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {replyTo ? (
          <div className="flex min-w-0 items-center gap-2 text-xs text-ash">
            <span className="min-w-0 truncate">Replying to <strong className="text-ink">{replyTo.name}</strong></span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="shrink-0 text-ember hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : null}
        {/*
          Rail fits at the 1024px viewport (worst case):
            backdrop lg:p-6      => panel = 1024 - 48 = 976
            grid rail track = minmax(340px,380px); guaranteed floor = 340
            composer sm:px-6     => content = 340 - 48 (24*2) = 292
            form row = avatar(size-8 = 32) + gap-3(12) + right column
                     => right column = 292 - 32 - 12 = 248
            right column row = textarea(flex-1,min-w-0) + gap-2(8) + Send(~92 "Sending...")
                     => textarea = 248 - 8 - 92 = 148px  (> 0, nothing clips)
          min-w-0 down the chain (grid track -> section -> composer col ->
          textarea) lets the textarea absorb all slack; Send and the counter are
          shrink-0 so they can never truncate to "Sen..." / "0/6".
        */}
        <div className="flex min-w-0 items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 600))}
            disabled={isPending}
            rows={1}
            aria-label={replyTo ? `Reply to ${replyTo.name}` : "Add a comment"}
            placeholder={replyTo ? `Reply to ${replyTo.name}` : "Add a comment"}
            className="min-h-9 min-w-0 flex-1 resize-none rounded-md border border-bone bg-cream px-3 py-2 text-sm text-ink placeholder:text-ash focus:border-ink focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-saffron px-4 text-sm text-cream transition-colors hover:bg-saffron/90 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {error ? (
            <span role="alert" className="min-w-0 text-xs text-ember">{error}</span>
          ) : (
            <span />
          )}
          <span className="shrink-0 text-caption">{body.length}/600</span>
        </div>
      </div>
    </form>
  );

  // Modal rail: header + independently-scrolling list + composer pinned to the
  // rail bottom on desktop; a simple stacked flow on mobile (whole panel scrolls).
  if (variant === "modal") {
    return (
      <section
        aria-label="Comments"
        className="flex min-h-0 min-w-0 flex-col border-t border-bone lg:flex-1 lg:overflow-hidden lg:border-t-0"
      >
        <p className="shrink-0 px-4 pb-3 pt-5 text-caption sm:px-6 lg:border-b lg:border-bone">
          Comments
        </p>
        <div className="px-4 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{listEl}</div>
        <div className="min-w-0 shrink-0 border-t border-bone bg-paper px-4 py-3 sm:px-6">{composerEl}</div>
      </section>
    );
  }

  // Full-page stacked thread.
  return (
    <section className="mt-10 border-t border-bone pt-6">
      <p className="mb-4 text-caption">Comments</p>
      {listEl}
      <div className="mt-4">{composerEl}</div>
    </section>
  );
}
