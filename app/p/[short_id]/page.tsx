import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTopNav } from "@/components/layout/PublicTopNav";
import { getPostByShortId } from "@/lib/db/posts";
import { PostDetail, loadPostDetail } from "@/components/composite/PostDetail";

export async function generateMetadata({ params }: { params: Promise<{ short_id: string }> }): Promise<Metadata> {
  const { short_id } = await params;
  const post = await getPostByShortId(short_id);

  if (!post) {
    return { title: "Post not found", robots: { index: false, follow: false } };
  }

  const title = `${post.author.name} on Collab47`;
  const description = post.body.slice(0, 160);
  const canonical = `/p/${short_id}`;
  const hasImage = post.image_urls.length > 0;

  return {
    title,
    description,
    alternates: { canonical },
    // Share images come from the dynamic app/p/[short_id]/opengraph-image.tsx card.
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: hasImage ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ short_id: string }> }) {
  const { short_id } = await params;
  const data = await loadPostDetail(short_id);

  if (!data) {
    notFound();
  }

  const { post } = data;

  const postJsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: post.body.slice(0, 110),
    articleBody: post.body,
    author: {
      "@type": "Person",
      name: post.author.name,
      url: post.author.handle ? `https://collab47.com/u/${post.author.handle}` : undefined,
    },
    image: post.image_urls,
    url: `https://collab47.com/p/${post.short_id}`,
  };

  return (
    <main className="min-h-dvh bg-cream">
      <PublicTopNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(postJsonLd) }} />
      {/* Geometry (fixed nav offset pt-32, container-edit max-w-2xl) is mirrored
          exactly by loading.tsx so there is no jump when the real page mounts. */}
      <article className="container-edit max-w-2xl pt-32 pb-20">
        <PostDetail data={data} layout="page" />
      </article>
    </main>
  );
}
