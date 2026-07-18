import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsItem } from "@/lib/news/fetch";
import { getNewsComments, isNewsSaved } from "@/lib/db/newsEngage";
import { getMyProfile } from "@/lib/db/profiles";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { NewsActions } from "@/components/composite/NewsActions";
import { NewsCommentThread } from "./NewsCommentThread";
import { Reveal } from "@/components/motion/Reveal";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const item = await getNewsItem(id);
  if (!item) return { title: "Story not found", robots: { index: false, follow: false } };
  const description = (item.summary ?? item.title).slice(0, 160);
  const url = `/news/${item.id}`;
  return {
    title: item.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: item.title,
      description,
      publishedTime: item.published_at,
      images: item.image_url ? [{ url: item.image_url }] : undefined,
    },
    twitter: {
      card: item.image_url ? "summary_large_image" : "summary",
      title: item.title,
      description,
    },
  };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Honest provenance for the summary block. The pipeline tags every stored item
 * (lib/news/fetch) with how its brief was produced; we surface that verbatim
 * instead of implying an editor wrote it. Never marketing ("AI-powered") - just
 * what actually happened to the text.
 */
function briefMeta(status: "ai" | "headline" | "raw" | "none"): { label: string; note: string | null } {
  switch (status) {
    case "ai":
      return { label: "The brief", note: "Auto-summarised from the full article" };
    case "headline":
      return { label: "The brief", note: "Expanded from the headline - no full text was published" };
    case "raw":
      return { label: "From the publisher", note: "The source's own excerpt, unedited" };
    default:
      return { label: "The brief", note: null };
  }
}

export default async function NewsReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, comments, saved, me] = await Promise.all([
    getNewsItem(id),
    getNewsComments(id),
    isNewsSaved(id),
    getMyProfile(),
  ]);

  if (!item) notFound();


  return (
    <div className="mx-auto max-w-2xl pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: item.title,
            datePublished: item.published_at,
            image: item.image_url ? [item.image_url] : undefined,
            articleSection: item.source,
            url: `https://collab47.com/news/${item.id}`,
            mainEntityOfPage: `https://collab47.com/news/${item.id}`,
            publisher: { "@type": "Organization", name: item.source },
          }),
        }}
      />
      <Link href="/news" className="inline-flex items-center gap-2 text-sm text-ink/70 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Back to News
      </Link>

      <article className="mt-6">
        {item.image_url ? (
          <Reveal>
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-bone bg-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image_url} alt="" className="h-full w-full object-cover" decoding="async" />
            </div>
          </Reveal>
        ) : (
          <div className="brand-gradient flex h-40 items-end rounded-xl p-5">
            <span className="text-xs font-medium uppercase tracking-widest text-cream">{item.source}</span>
          </div>
        )}

        {/* Source attribution + timestamp - always visible, whether or not the
            story has a lead image. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
          <span className="font-semibold uppercase tracking-widest text-saffron-dk">{item.source}</span>
          <span className="text-ink/30" aria-hidden>&#183;</span>
          <span className="normal-case tracking-normal text-ink/60">{timeAgo(item.published_at)}</span>
        </div>

        <h1 className="mt-3 max-w-[20ch] font-serif text-h1 font-medium leading-[1.14] text-ink sm:text-[2.6rem]">
          {item.title}
        </h1>

        {/* The brief. Its label + provenance note stay honest to how the text
            was produced (summary_status); never fall back to a raw blurb dressed
            up as an editor's summary; show a neutral prompt when absent. */}
        {item.summary ? (
          (() => {
            const meta = briefMeta(item.summary_status);
            return (
              <div className="mt-7 rounded-xl border border-bone bg-paper p-6">
                <p className="text-caption font-semibold uppercase tracking-widest text-saffron">
                  {meta.label}
                </p>
                <p className="mt-3 max-w-[65ch] whitespace-pre-line text-body-lg leading-relaxed text-ink/90">
                  {item.summary}
                </p>
                {meta.note ? (
                  <p className="mt-4 border-t border-bone pt-3 text-caption normal-case tracking-normal text-ash">
                    {meta.note}
                  </p>
                ) : null}
              </div>
            );
          })()
        ) : (
          <p className="mt-7 max-w-[65ch] text-body italic leading-relaxed text-ink/55">
            No summary was available for this story. Open the full article below to read it at the source.
          </p>
        )}

        {/* News action bar: Save (primary) + More/Less + Share + overflow Report. */}
        <div className="mt-6 border-t border-bone pt-5">
          <NewsActions
            newsId={item.id}
            commentCount={item.comment_count}
            initialSaved={saved}
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

      <NewsCommentThread
        newsId={item.id}
        initialComments={comments}
        viewer={me ? { handle: me.handle, name: me.name, avatar_url: me.avatar_url } : null}
      />
    </div>
  );
}
