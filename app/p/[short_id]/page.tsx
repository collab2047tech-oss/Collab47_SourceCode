import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import { getPostByShortId, getPostComments } from "@/lib/db/posts";
import { getMyEngagementState } from "@/lib/db/engagement";
import { PostDetailActions } from "@/components/composite/PostDetailActions";
import { CommentsSection } from "@/components/composite/CommentsSection";

export default async function PostPage({ params }: { params: Promise<{ short_id: string }> }) {
  const { short_id } = await params;
  const post = await getPostByShortId(short_id);

  if (!post) {
    return (
      <main className="min-h-dvh bg-cream">
        <Nav />
        <div className="container-edit pt-40">
          <h1 className="font-serif text-5xl text-ink">
            Post <span className="italic text-saffron">not found.</span>
          </h1>
          <p className="mt-4 text-body text-ash">It may have expired (24-hour ephemeral) or been removed.</p>
          <Link href="/" className="mt-8 inline-block underline text-saffron">Back home</Link>
        </div>
      </main>
    );
  }

  const [engagement, comments] = await Promise.all([
    getMyEngagementState([post.id]),
    getPostComments(post.id),
  ]);

  const initialLiked = engagement.likes.has(post.id);
  const initialSaved = engagement.bookmarks.has(post.id);

  return (
    <main className="min-h-dvh bg-cream">
      <Nav />
      <article className="container-edit max-w-2xl pt-32 pb-20">
        <Reveal>
          <div className="flex items-center gap-3">
            <Link href={`/u/${post.author.handle}`} className="flex items-center gap-3">
              <Avatar name={post.author.name} src={post.author.avatar_url ?? undefined} size="md" />
              <div>
                <p className="text-base font-semibold text-ink">{post.author.name}</p>
                <p className="text-xs text-ash">@{post.author.handle} . {post.author.college}</p>
              </div>
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-8 whitespace-pre-wrap text-h3 leading-relaxed text-ink">{post.body}</p>
        </Reveal>
        {post.image_urls.length > 0 ? (
          <Reveal delay={0.1}>
            <div className="mt-8 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(post.image_urls.length, 2)}, 1fr)` }}>
              {post.image_urls.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full rounded-lg border border-bone" />
              ))}
            </div>
          </Reveal>
        ) : null}
        {post.video_url ? (
          <Reveal delay={0.1}>
            <video src={post.video_url} controls className="mt-8 w-full rounded-lg border border-bone" />
          </Reveal>
        ) : null}
        {post.hashtags.length > 0 ? (
          <Reveal delay={0.15}>
            <div className="mt-6 flex flex-wrap gap-2">
              {post.hashtags.map((h) => (
                <Tag key={h} variant="outline">#{h}</Tag>
              ))}
            </div>
          </Reveal>
        ) : null}

        {/* Action bar: Like, Comment count, Bookmark, Share - all wired */}
        <Reveal delay={0.2}>
          <PostDetailActions
            postId={post.id}
            shortId={post.short_id}
            initialLiked={initialLiked}
            initialSaved={initialSaved}
            likeCount={post.like_count}
            commentCount={post.comment_count}
            bookmarkCount={post.bookmark_count}
          />
        </Reveal>

        {/* Comments thread */}
        <Reveal delay={0.25}>
          <CommentsSection
            postId={post.id}
            initialComments={comments}
          />
        </Reveal>
      </article>
    </main>
  );
}
