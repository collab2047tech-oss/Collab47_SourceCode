"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { addNewsCommentAction } from "@/app/(app)/news/actions";
import type { NewsComment } from "@/lib/db/newsEngage";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Viewer {
  handle: string;
  name: string;
  avatar_url: string | null;
}

interface Props {
  newsId: string;
  initialComments: NewsComment[];
  viewer: Viewer | null;
}

export function NewsCommentThread({ newsId, initialComments, viewer }: Props) {
  const [comments, setComments] = useState<NewsComment[]>(initialComments);
  const [optimistic, addOptimistic] = useOptimistic<NewsComment[], NewsComment>(
    comments,
    (state, next) => [...state, next]
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(formData: FormData) {
    const body = (formData.get("body")?.toString() ?? "").trim();
    if (!body) return;
    setError(null);

    const optimisticComment: NewsComment = {
      id: `temp-${Date.now()}`,
      news_id: newsId,
      author_id: "me",
      body,
      created_at: new Date().toISOString(),
      author: viewer
        ? { handle: viewer.handle, name: viewer.name, avatar_url: viewer.avatar_url }
        : null,
    };

    startTransition(async () => {
      addOptimistic(optimisticComment); // appears instantly
      formRef.current?.reset();
      const res = await addNewsCommentAction(newsId, formData);
      if (res.ok) {
        // Reconcile: commit the REAL inserted row (real id + resolved author) so
        // the placeholder's fake author_id:"me"/null author never persists and
        // renders as "Unknown". Fall back to the optimistic entry only if the
        // action returned ok without a row (e.g. the no-Supabase mock path).
        setComments((prev) => [...prev, res.comment ?? optimisticComment]);
      } else {
        setError(res.error ?? "Could not post your comment. Try again.");
      }
    });
  }

  return (
    <section id="comments" className="mt-12 border-t border-bone pt-10">
      <h2 className="flex items-center gap-2 font-serif text-h3 text-ink">
        <MessageCircle className="size-5 text-saffron" />
        Discussion {optimistic.length > 0 ? `(${optimistic.length})` : ""}
      </h2>
      <p className="mt-1 text-sm text-ink/60">Talk through this story with your campus.</p>

      {/* Composer (optimistic) */}
      <form ref={formRef} action={submit} className="mt-5">
        <textarea
          name="body"
          rows={3}
          maxLength={600}
          required
          placeholder="Add to the discussion (max 600 chars)..."
          className="w-full resize-none rounded-lg border border-bone bg-paper p-3 text-sm text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
        />
        {error ? <p className="mt-2 text-sm text-ember">{error}</p> : null}
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream transition-all hover:bg-saffron active:scale-95"
          >
            Post
          </button>
        </div>
      </form>

      {/* List */}
      {optimistic.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-bone bg-paper/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No comments yet.</p>
          <p className="mt-1 text-sm text-ink/60">Be the first to share your take.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {optimistic.map((c) => (
            <div key={c.id} className="card card-hover p-4">
              <div className="flex items-center gap-2">
                {c.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.author.avatar_url} alt="" className="size-7 rounded-full object-cover" />
                ) : (
                  <div className="size-7 rounded-full bg-bone" />
                )}
                <Link
                  href={`/u/${c.author?.handle ?? ""}`}
                  className="text-sm font-medium text-ink hover:text-saffron"
                >
                  {c.author?.name ?? "Unknown"}
                </Link>
                <span className="text-xs text-ink/60">{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink/85">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
