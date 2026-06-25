import { getSupabaseServer } from "@/lib/supabase/server";
import type { Post } from "@/lib/supabase/types";
import { overLimit, LIMITS, RATE_LIMITED } from "@/lib/security/ratelimit";

export interface PostAuthor {
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
}

/**
 * The original post embedded inside a repost. Carries the original's author and
 * content so a repost can be rendered LinkedIn-style (the original nested inside).
 */
export interface RepostedOriginal extends Post {
  author: PostAuthor | null;
}

export interface PostWithAuthor extends Post {
  author: { handle: string; name: string; avatar_url: string | null; college: string | null };
  /**
   * For reposts (is_repost = true): the original post + its author. Null when the
   * original was deleted/expired or could not be resolved.
   */
  reposted_from?: RepostedOriginal | null;
}

// Author embed fragment (profiles FK — works fine).
const AUTHOR_EMBED =
  "author:profiles!posts_author_id_fkey(handle,name,avatar_url,college)";

/**
 * Resolve the original post embedded inside reposts via a SECOND batched query.
 *
 * PostgREST cannot embed a self-referential FK (posts -> posts) by hint, so we
 * collect every reposted_from_post_id and fetch the originals (+ their authors)
 * in one `.in()` round-trip, then attach them as `reposted_from`. Mutates and
 * returns the same array. Shared by profile, feed and tag queries.
 */
export async function attachReposts<T extends PostWithAuthor>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  posts: T[],
): Promise<T[]> {
  const originalIds = Array.from(
    new Set(
      posts
        .filter((p) => p.is_repost && p.reposted_from_post_id)
        .map((p) => p.reposted_from_post_id as string),
    ),
  );
  if (originalIds.length === 0) return posts;

  const { data: originals } = await sb
    .from("posts")
    .select(`*, ${AUTHOR_EMBED}`)
    .in("id", originalIds);

  const byId = new Map<string, RepostedOriginal>();
  for (const o of (originals ?? []) as RepostedOriginal[]) byId.set(o.id, o);

  for (const p of posts) {
    if (p.is_repost && p.reposted_from_post_id) {
      p.reposted_from = byId.get(p.reposted_from_post_id) ?? null;
    }
  }
  return posts;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getPostByShortId(shortId: string): Promise<PostWithAuthor | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb
    .from("posts")
    .select(`*, ${AUTHOR_EMBED}`)
    .eq("short_id", shortId)
    .maybeSingle();
  if (!data) return null;
  const [post] = await attachReposts(sb, [data as unknown as PostWithAuthor]);
  return post;
}

export async function getProfilePosts(profileId: string, limit = 24): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb
    .from("posts")
    .select(`*, ${AUTHOR_EMBED}`)
    .eq("author_id", profileId)
    .or("expires_at.is.null,expires_at.gt.now(),is_pinned.eq.true")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return attachReposts(sb, (data as unknown as PostWithAuthor[]) ?? []);
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export interface CreatePostInput {
  body: string;
  image_urls?: string[];
  video_url?: string | null;
  hashtags?: string[];
  branch_tags?: string[];
  city_tags?: string[];
  is_repost?: boolean;
  reposted_from_post_id?: string | null;
  /** Optional: link this post to a project as a progress update. */
  project_id?: string | null;
}

export interface PostMutationResult {
  ok: boolean;
  postId?: string;
  shortId?: string;
  error?: string;
}

const NO_BACKEND: PostMutationResult = { ok: false, error: "Database not connected." };

/**
 * createPost - insert a new post owned by the currently authenticated user.
 * expires_at defaults to 24 hours from now. Server-only.
 */
export async function createPost(input: CreatePostInput): Promise<PostMutationResult> {
  const sb = await getSupabaseServer();
  if (!sb) return NO_BACKEND;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  if (await overLimit(sb, { table: "posts", userColumn: "author_id", userId: user.id, ...LIMITS.post })) {
    return { ok: false, error: RATE_LIMITED };
  }

  const { data, error } = await sb
    .from("posts")
    .insert({
      author_id: user.id,
      body: input.body,
      image_urls: input.image_urls ?? [],
      video_url: input.video_url ?? null,
      hashtags: input.hashtags ?? [],
      branch_tags: input.branch_tags ?? [],
      city_tags: input.city_tags ?? [],
      is_repost: input.is_repost ?? false,
      reposted_from_post_id: input.reposted_from_post_id ?? null,
      project_id: input.project_id ?? null,
      // Normal posts are PERMANENT (LinkedIn-style). Only reposts of others are
      // ephemeral (24h, Instagram-story-style).
      expires_at: input.is_repost
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
    })
    .select("id, short_id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, postId: data.id, shortId: data.short_id };
}

/**
 * deletePost - hard delete. RLS enforces author ownership.
 */
export async function deletePost(postId: string): Promise<PostMutationResult> {
  const sb = await getSupabaseServer();
  if (!sb) return NO_BACKEND;

  const { error } = await sb.from("posts").delete().eq("id", postId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, postId };
}

/**
 * pinPost - pin a post to the author's portfolio. Clears expires_at.
 * Rejects if the user already has 12 pinned posts.
 */
export async function pinPost(postId: string): Promise<PostMutationResult> {
  const sb = await getSupabaseServer();
  if (!sb) return NO_BACKEND;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Check current pin count
  const { count } = await sb
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("is_pinned", true);

  if ((count ?? 0) >= 12) {
    return { ok: false, error: "You can only pin up to 12 posts." };
  }

  const { error } = await sb
    .from("posts")
    .update({ is_pinned: true, expires_at: null })
    .eq("id", postId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, postId };
}

/**
 * unpinPost - unpin a post. Keeps expires_at null (post survived 24h window).
 */
export async function unpinPost(postId: string): Promise<PostMutationResult> {
  const sb = await getSupabaseServer();
  if (!sb) return NO_BACKEND;

  const { error } = await sb
    .from("posts")
    .update({ is_pinned: false })
    .eq("id", postId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, postId };
}

/**
 * convertRepostToHighlight - mark a repost as a highlight and clear expires_at.
 * Only valid while the post is still a repost and within the 24h window.
 */
// ---------------------------------------------------------------------------
// Comment read helpers
// ---------------------------------------------------------------------------

export interface CommentWithAuthor {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  /** The author's user id — needed so the UI can show "Delete" only to the author. */
  author_id: string;
  author: { handle: string; name: string; avatar_url: string | null };
}

export async function getPostComments(postId: string): Promise<CommentWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb
    .from("comments")
    .select("id, body, created_at, parent_comment_id, author_id, author:profiles!comments_author_id_fkey(handle,name,avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as CommentWithAuthor[]) ?? [];
}

export async function convertRepostToHighlight(postId: string): Promise<PostMutationResult> {
  const sb = await getSupabaseServer();
  if (!sb) return NO_BACKEND;

  // Fetch the post to validate it's a repost and still live
  const { data: post, error: fetchError } = await sb
    .from("posts")
    .select("is_repost, expires_at")
    .eq("id", postId)
    .single();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!post.is_repost) return { ok: false, error: "Only reposts can be saved as highlights." };

  const expired =
    post.expires_at !== null && new Date(post.expires_at) < new Date();
  if (expired) return { ok: false, error: "This repost has already expired." };

  const { error } = await sb
    .from("posts")
    .update({ is_highlight: true, expires_at: null })
    .eq("id", postId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, postId };
}
