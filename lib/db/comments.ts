import { getSupabaseServer } from "@/lib/supabase/server";

interface OkResult { ok: true }
interface ErrResult { ok: false; error: string }
type Result = OkResult | ErrResult;

/** Like a comment (or reply) as the currently authenticated user. */
export async function likeComment(commentId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb
    .from("comment_likes")
    .insert({ comment_id: commentId, user_id: user.id });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

/** Remove the current user's like from a comment. */
export async function unlikeComment(commentId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb
    .from("comment_likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface CommentLikeState {
  /** comment_id -> like count */
  counts: Record<string, number>;
  /** set of comment_ids the current user has liked */
  liked: Set<string>;
}

/**
 * Fetch like counts for a set of comments and which of them the current user
 * has liked. Companion to getPostComments - call it from the page with the
 * comment ids and pass the result to CommentsSection.
 */
export async function getCommentLikeState(commentIds: string[]): Promise<CommentLikeState> {
  const empty: CommentLikeState = { counts: {}, liked: new Set() };
  if (commentIds.length === 0) return empty;
  const sb = await getSupabaseServer();
  if (!sb) return empty;

  const { data: { user } } = await sb.auth.getUser();

  const { data: rows } = await sb
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  const counts: Record<string, number> = {};
  const liked = new Set<string>();
  for (const r of rows ?? []) {
    const cid = (r as { comment_id: string }).comment_id;
    counts[cid] = (counts[cid] ?? 0) + 1;
    if (user && (r as { user_id: string }).user_id === user.id) liked.add(cid);
  }
  return { counts, liked };
}
