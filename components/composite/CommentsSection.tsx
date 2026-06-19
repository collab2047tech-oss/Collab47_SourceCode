"use client";

import { useState, useTransition, useOptimistic } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { Send } from "lucide-react";
import type { CommentWithAuthor } from "@/lib/db/posts";
import { addCommentOnPostAction } from "@/app/p/[short_id]/actions";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  postId: string;
  initialComments: CommentWithAuthor[];
  currentUserName?: string;
}

export function CommentsSection({ postId, initialComments, currentUserName = "You" }: Props) {
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

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
          tops.map((c) => (
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
                  <button
                    type="button"
                    onClick={() => setReplyTo({ id: c.id, name: c.author.name })}
                    className="mt-1 text-xs text-ash hover:text-ink transition-colors"
                  >
                    Reply
                  </button>
                </div>
              </article>

              {/* Replies */}
              {repliesMap.get(c.id)?.length ? (
                <ul className="ml-10 mt-3 space-y-3 border-l border-bone pl-4">
                  {repliesMap.get(c.id)!.map((r) => (
                    <li key={r.id}>
                      <article className="flex items-start gap-2">
                        <Avatar name={r.author.name} src={r.author.avatar_url ?? undefined} size="xs" />
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-ink">{r.author.name}</span>
                            <span className="text-xs text-ash">{relativeTime(r.created_at)}</span>
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-ink">{r.body}</p>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))
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
