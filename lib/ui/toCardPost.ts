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

/** Absolute, locale-aware timestamp for the "hover for exact time" affordance. */
export function absoluteTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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
      avatar_url: p.author?.avatar_url ?? null,
    },
    time: relativeTime(p.created_at),
    created_at: p.created_at,
    body: p.body,
    tags: p.hashtags ?? [],
    // Carry EVERY image and the video, not just image_urls[0]. The card renders
    // a real media gallery / inline <video> from these.
    images: p.image_urls ?? [],
    video: p.video_url ?? null,
    stats: {
      likes: p.like_count ?? 0,
      comments: p.comment_count ?? 0,
      saves: p.bookmark_count ?? 0,
      reposts: p.repost_count ?? 0,
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
              avatar_url: p.reposted_from.author?.avatar_url ?? null,
            },
            time: relativeTime(p.reposted_from.created_at),
            body: p.reposted_from.body,
            tags: p.reposted_from.hashtags ?? [],
            images: p.reposted_from.image_urls ?? [],
            video: p.reposted_from.video_url ?? null,
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
