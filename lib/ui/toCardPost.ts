import type { PostWithAuthor } from "@/lib/db/posts";
import type { Post as CardPost } from "@/components/composite/PostCard";

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// Map a DB post row to the shape PostCard renders.
export function toCardPost(p: PostWithAuthor): CardPost {
  return {
    id: p.id,
    short_id: p.short_id,
    author_id: p.author_id,
    author: {
      name: p.author?.name ?? "Unknown",
      handle: p.author?.handle ?? "",
      college: p.author?.college ?? "",
    },
    time: relativeTime(p.created_at),
    body: p.body,
    tags: p.hashtags ?? [],
    image: p.image_urls?.[0],
    stats: {
      likes: p.like_count ?? 0,
      comments: p.comment_count ?? 0,
      saves: p.bookmark_count ?? 0,
    },
    variant: "standard",
    is_pinned: p.is_pinned,
    is_repost: p.is_repost,
    repostOf: p.is_repost
      ? p.reposted_from && !p.reposted_from.deleted_at
        ? {
            short_id: p.reposted_from.short_id,
            author: {
              name: p.reposted_from.author?.name ?? "Unknown",
              handle: p.reposted_from.author?.handle ?? "",
              college: p.reposted_from.author?.college ?? "",
            },
            time: relativeTime(p.reposted_from.created_at),
            body: p.reposted_from.body,
            tags: p.reposted_from.hashtags ?? [],
            image: p.reposted_from.image_urls?.[0],
            stats: {
              likes: p.reposted_from.like_count ?? 0,
              comments: p.reposted_from.comment_count ?? 0,
            },
          }
        : null
      : undefined,
    reaction: undefined,
  };
}
