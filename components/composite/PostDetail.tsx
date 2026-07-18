import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { PostMedia } from "./post/PostMedia";
import { PostDetailActions } from "./PostDetailActions";
import { CommentsSection } from "./CommentsSection";
import { getPostByShortId, getPostComments } from "@/lib/db/posts";
import { getCommentLikeState } from "@/lib/db/comments";
import { getMyEngagementState } from "@/lib/db/engagement";
import { getMyProfile } from "@/lib/db/profiles";
import { relativeTime, absoluteTime } from "@/lib/ui/toCardPost";
import type { PostWithAuthor, CommentWithAuthor } from "@/lib/db/posts";

/**
 * The single source of truth for post-detail content. Both the standalone public
 * page (`app/p/[short_id]/page.tsx`, external shares + SEO) AND the intercepted
 * in-app modal (`app/(app)/@modal/(.)p/[short_id]/page.tsx`) render this exact
 * component from the exact same server data, so the two can never drift.
 *
 *  - `layout="page"`  -> stacked single column (post, then comments) for the
 *                        full-page share view. One subtle CSS fade, no stagger.
 *  - `layout="modal"` -> LinkedIn overlay: two independent scroll columns on
 *                        desktop (post left, comments rail right with a pinned
 *                        composer); a stacked single scroll on mobile.
 */

export interface PostDetailData {
  post: PostWithAuthor;
  initialLiked: boolean;
  initialSaved: boolean;
  initialReaction?: string;
  comments: CommentWithAuthor[];
  initialLikes: { counts: Record<string, number>; liked: string[] };
  me: { id: string; name: string } | null;
}

/**
 * Fetch everything the detail view needs via the SAME server functions the full
 * page has always used. Returns null when the post does not exist so each caller
 * can choose how to degrade (full page -> notFound(); modal -> inline message).
 */
export async function loadPostDetail(shortId: string): Promise<PostDetailData | null> {
  const post = await getPostByShortId(shortId);
  if (!post) return null;

  const [engagement, comments, me] = await Promise.all([
    getMyEngagementState([post.id]),
    getPostComments(post.id),
    getMyProfile(),
  ]);

  const likeState = await getCommentLikeState(comments.map((c) => c.id));

  return {
    post,
    initialLiked: engagement.likes.has(post.id),
    initialSaved: engagement.bookmarks.has(post.id),
    initialReaction: engagement.reactions.get(post.id),
    comments,
    initialLikes: { counts: likeState.counts, liked: Array.from(likeState.liked) },
    me: me ? { id: me.id, name: me.name } : null,
  };
}

/** The post itself: author row + body + media + tags + action bar. Shared by
 *  both layouts. Body stays Inter at feed-equivalent size (NOT text-h3) so
 *  opening a post never "blasts" the reader with a 48%-larger paragraph. */
function PostBody({
  post,
  initialLiked,
  initialSaved,
  initialReaction,
}: {
  post: PostWithAuthor;
  initialLiked: boolean;
  initialSaved: boolean;
  initialReaction?: string;
}) {
  const author = post.author;
  const meta = (
    <p className="text-xs text-ash">
      {author?.handle ? `@${author.handle}` : null}
      {author?.handle && author?.college ? " · " : ""}
      {author?.college ?? ""}
      {(author?.handle || author?.college) && post.created_at ? " · " : ""}
      <span title={post.created_at ? absoluteTime(post.created_at) : undefined}>
        {post.created_at ? relativeTime(post.created_at) : ""}
      </span>
    </p>
  );

  return (
    <div>
      {/* Author row */}
      {author?.handle ? (
        <Link href={`/u/${author.handle}`} className="group flex items-center gap-3">
          <Avatar name={author.name} src={author.avatar_url ?? undefined} size="md" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink transition-colors group-hover:text-saffron">
              {author.name}
            </p>
            {meta}
          </div>
        </Link>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar name={author?.name ?? "Unknown"} src={author?.avatar_url ?? undefined} size="md" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{author?.name ?? "Unknown"}</p>
            {meta}
          </div>
        </div>
      )}

      {/* Body - feed-equivalent Inter size (matches PostCard's text-[0.95rem]). */}
      {post.body ? (
        <p className="mt-5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink wrap-break-word">
          {post.body}
        </p>
      ) : null}

      {/* Media - reuse the feed gallery so tiles sit in fixed aspect boxes (no CLS). */}
      <PostMedia images={post.image_urls ?? []} video={post.video_url ?? null} shortId={post.short_id} />

      {/* Hashtags (plain tags - no /t link route on this surface). */}
      {post.hashtags && post.hashtags.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {post.hashtags.map((h) => (
            <Tag key={h} variant="outline">
              #{h}
            </Tag>
          ))}
        </div>
      ) : null}

      {/* Action bar */}
      <PostDetailActions
        postId={post.id}
        shortId={post.short_id}
        initialLiked={initialLiked}
        initialSaved={initialSaved}
        initialReaction={initialReaction}
        likeCount={post.like_count}
        commentCount={post.comment_count}
        bookmarkCount={post.bookmark_count}
      />
    </div>
  );
}

export function PostDetail({ data, layout }: { data: PostDetailData; layout: "page" | "modal" }) {
  const { post, initialLiked, initialSaved, initialReaction, comments, initialLikes, me } = data;

  const body = (
    <PostBody
      post={post}
      initialLiked={initialLiked}
      initialSaved={initialSaved}
      initialReaction={initialReaction}
    />
  );

  const commentsEl = (
    <CommentsSection
      postId={post.id}
      initialComments={comments}
      initialLikes={initialLikes}
      currentUserId={me?.id ?? ""}
      currentUserName={me?.name ?? "You"}
      variant={layout}
    />
  );

  if (layout === "modal") {
    // Mobile: one scroll (flex-col + overflow-y-auto). Desktop: two independent
    // scroll columns (post left, comments rail right).
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] lg:overflow-hidden">
        <div className="px-4 py-6 sm:px-6 lg:min-h-0 lg:min-w-0 lg:overflow-y-auto lg:border-r lg:border-bone">
          {body}
        </div>
        {commentsEl}
      </div>
    );
  }

  // Full page: stacked, single subtle CSS fade (no JS-gated visibility, no stagger).
  return (
    <div className="c47-detail-in">
      {body}
      {commentsEl}
    </div>
  );
}
