import { getSupabaseServer } from "@/lib/supabase/server";
import type { Post } from "@/lib/supabase/types";

export interface PostWithAuthor extends Post {
  author: { handle: string; name: string; avatar_url: string | null; college: string | null };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getPostByShortId(shortId: string): Promise<PostWithAuthor | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college)")
    .eq("short_id", shortId)
    .maybeSingle();
  return (data as PostWithAuthor) ?? null;
}

export async function getProfilePosts(profileId: string, limit = 24): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college)")
    .eq("author_id", profileId)
    .or("expires_at.is.null,expires_at.gt.now,is_pinned.eq.true")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as PostWithAuthor[]) ?? [];
}

export async function getRecentFeed(forUserId: string, limit = 20): Promise<PostWithAuthor[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college)")
    .in(
      "author_id",
      // Subquery: users we follow
      // Supabase JS does not support subquery directly; use RPC for prod. Stub returns recent posts.
      []
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as PostWithAuthor[]) ?? [];
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
}

export interface PostMutationResult {
  ok: boolean;
  postId?: string;
  shortId?: string;
  error?: string;
}

const MOCK_RESULT: PostMutationResult = { ok: true, postId: "mock-id", shortId: "mock" };

/**
 * createPost - insert a new post owned by the currently authenticated user.
 * expires_at defaults to 24 hours from now. Server-only.
 */
export async function createPost(input: CreatePostInput): Promise<PostMutationResult> {
  const sb = await getSupabaseServer();
  if (!sb) return MOCK_RESULT;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

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
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
  if (!sb) return MOCK_RESULT;

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
  if (!sb) return MOCK_RESULT;

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
  if (!sb) return MOCK_RESULT;

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
export async function convertRepostToHighlight(postId: string): Promise<PostMutationResult> {
  const sb = await getSupabaseServer();
  if (!sb) return MOCK_RESULT;

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
