"use server";

import { revalidatePath } from "next/cache";
import { addComment, deleteComment } from "@/lib/db/engagement";

export async function addCommentOnPostAction(formData: FormData) {
  const postId = formData.get("postId")?.toString() ?? "";
  const body = formData.get("body")?.toString() ?? "";
  const parentCommentId = formData.get("parentCommentId")?.toString() || null;
  if (!postId) return { ok: false as const, error: "Missing postId" };
  const res = await addComment({ postId, body, parentCommentId });
  if (res.ok) revalidatePath(`/p`);
  return res;
}

export async function deleteCommentOnPostAction(commentId: string) {
  if (!commentId) return { ok: false as const, error: "Missing commentId" };
  const res = await deleteComment(commentId);
  if (res.ok) revalidatePath("/p/[short_id]", "page");
  return res;
}
