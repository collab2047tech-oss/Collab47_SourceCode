import Link from "next/link";
import { getNewsItem } from "@/lib/news/fetch";
import { getMyNewsReaction, getNewsComments } from "@/lib/db/newsEngage";
import { addNewsCommentAction } from "@/app/(app)/news/actions";
import { ArrowLeft, ExternalLink, MessageCircle } from "lucide-react";
import { NewsActions } from "@/components/composite/NewsActions";
import { Reveal } from "@/components/motion/Reveal";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function readMinutes(text: string | null | undefined): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function NewsReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, myReaction, comments] = await Promise.all([
    getNewsItem(id),
    getMyNewsReaction(id),
    getNewsComments(id),
  ]);

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="font-serif text-h2 text-ink">Story not found.</h1>
        <Link href="/news" className="mt-4 inline-block text-saffron underline">Back to News</Link>
      </div>
    );
  }

  async function postComment(formData: FormData): Promise<void> {
    "use server";
    await addNewsCommentAction(id, formData);
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <Link href="/news" className="inline-flex items-center gap-2 text-sm text-ash transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Back to News
      </Link>

      <article className="mt-6">
        {item.image_url ? (
          <Reveal>
            <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-xl border border-bone bg-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image_url} alt="" className="max-h-[60vh] w-full object-contain" />
            </div>
          </Reveal>
        ) : (
          <div className="flex h-40 items-end rounded-xl bg-[linear-gradient(135deg,#0A0F1C_0%,#1E40D6_100%)] p-5">
            <span className="text-xs font-medium uppercase tracking-widest text-cream/90">{item.source}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
          <span className="font-medium uppercase tracking-widest">{item.source}</span>
          <span className="text-ash">&#183;</span>
          <span className="text-ash">{timeAgo(item.published_at)}</span>
          <span className="text-ash">&#183;</span>
          <span className="text-ash">{readMinutes(item.excerpt)} min read</span>
        </div>

        <h1 className="mt-3 font-serif text-h1 leading-tight text-ink">{item.title}</h1>

        {item.excerpt ? (
          <p className="mt-6 whitespace-pre-line text-body-lg leading-relaxed text-ink/85">{item.excerpt}</p>
        ) : (
          <p className="mt-6 text-body text-ash">Summary unavailable for this story.</p>
        )}

        {item.branch_tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {item.branch_tags.slice(0, 5).map((t) => (
              <span key={t} className="rounded-full bg-saffron/10 px-2.5 py-0.5 text-xs font-medium text-saffron">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Engagement actions */}
        <div className="mt-6 border-t border-bone pt-5">
          <NewsActions
            newsId={item.id}
            initialLikeCount={item.like_count}
            initialDislikeCount={item.dislike_count}
            commentCount={item.comment_count}
            myReaction={myReaction}
          />
        </div>

        {/* Full original at the publisher */}
        <div className="mt-6 border-t border-bone pt-6">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-saffron"
          >
            Read full story on {item.source} <ExternalLink className="size-4" />
          </a>
        </div>
      </article>

      {/* Comments thread */}
      <section id="comments" className="mt-12 border-t border-bone pt-10">
        <h2 className="flex items-center gap-2 font-serif text-h3 text-ink">
          <MessageCircle className="size-5 text-saffron" />
          Comments {comments.length > 0 ? `(${comments.length})` : ""}
        </h2>

        {/* Composer */}
        <form action={postComment} className="mt-5">
          <textarea
            name="body"
            rows={3}
            maxLength={600}
            required
            placeholder="Add a comment (max 600 chars)..."
            className="w-full resize-none rounded-lg border border-bone bg-paper p-3 text-sm text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream transition-all hover:bg-saffron active:scale-95"
            >
              Post comment
            </button>
          </div>
        </form>

        {/* List */}
        {comments.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-bone bg-paper/50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">No comments yet.</p>
            <p className="mt-1 text-sm text-ash">Be the first to share your take.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="card card-hover p-4">
                <div className="flex items-center gap-2">
                  {c.author?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.author.avatar_url}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-7 rounded-full bg-bone" />
                  )}
                  <Link
                    href={`/u/${c.author?.handle ?? ""}`}
                    className="text-sm font-medium text-ink hover:text-saffron"
                  >
                    {c.author?.name ?? "Unknown"}
                  </Link>
                  <span className="text-xs text-ash">{timeAgo(c.created_at)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/85">{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
