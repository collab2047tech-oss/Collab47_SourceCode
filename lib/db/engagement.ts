import { getSupabaseServer } from "@/lib/supabase/server";

interface OkResult { ok: true }
interface ErrResult { ok: false; error: string }
type Result = OkResult | ErrResult;

export async function likePost(postId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("likes").insert({ post_id: postId, user_id: user.id });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unlikePost(postId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addComment(args: {
  postId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<Result & { commentId?: string }> {
  const body = args.body.trim();
  if (!body) return { ok: false, error: "Comment cannot be empty" };
  if (body.length > 600) return { ok: false, error: "Comment too long (max 600)" };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: true, commentId: "mock-comment" };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // reject depth > 1
  if (args.parentCommentId) {
    const { data: parent } = await sb
      .from("comments")
      .select("parent_comment_id")
      .eq("id", args.parentCommentId)
      .maybeSingle();
    if (parent?.parent_comment_id) return { ok: false, error: "Only one level of replies allowed" };
  }

  const { data, error } = await sb
    .from("comments")
    .insert({
      post_id: args.postId,
      author_id: user.id,
      parent_comment_id: args.parentCommentId ?? null,
      body,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, commentId: data.id as string };
}

export async function deleteComment(commentId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { error } = await sb.from("comments").delete().eq("id", commentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function repostPost(args: {
  originalPostId: string;
  addedBody?: string;
}): Promise<Result & { postId?: string; shortId?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true, postId: "mock-id", shortId: "mock" };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: original } = await sb
    .from("posts")
    .select("hashtags, branch_tags, city_tags")
    .eq("id", args.originalPostId)
    .maybeSingle();
  if (!original) return { ok: false, error: "Original post not found" };

  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const body = (args.addedBody ?? "").slice(0, 2000);

  const { data, error } = await sb
    .from("posts")
    .insert({
      author_id: user.id,
      body,
      is_repost: true,
      reposted_from_post_id: args.originalPostId,
      hashtags: original.hashtags ?? [],
      branch_tags: original.branch_tags ?? [],
      city_tags: original.city_tags ?? [],
      expires_at,
    })
    .select("id, short_id")
    .single();
  if (error) return { ok: false, error: error.message };

  // bump repost_count on original (best-effort; ignore if rpc absent)
  try {
    await sb.rpc("increment_repost_count", { post_id: args.originalPostId });
  } catch {
    // rpc not defined yet; counts can be backfilled by a nightly job
  }

  return { ok: true, postId: data.id as string, shortId: data.short_id as string };
}

export async function removeRepost(repostPostId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { error } = await sb.from("posts").delete().eq("id", repostPostId).eq("is_repost", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function bookmarkPost(postId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("bookmarks").insert({ post_id: postId, user_id: user.id });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unbookmarkPost(postId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("bookmarks").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMyEngagementState(postIds: string[]) {
  const sb = await getSupabaseServer();
  if (!sb || postIds.length === 0) return { likes: new Set<string>(), bookmarks: new Set<string>() };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { likes: new Set<string>(), bookmarks: new Set<string>() };

  const [{ data: likes }, { data: bookmarks }] = await Promise.all([
    sb.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
    sb.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds),
  ]);

  return {
    likes: new Set((likes ?? []).map((r) => r.post_id as string)),
    bookmarks: new Set((bookmarks ?? []).map((r) => r.post_id as string)),
  };
}
