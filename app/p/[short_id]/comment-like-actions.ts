"use server";

import { revalidatePath } from "next/cache";
import { likeComment, unlikeComment } from "@/lib/db/comments";

export async function likeCommentAction(commentId: string) {
  if (!commentId) return { ok: false as const, error: "Missing commentId" };
  const res = await likeComment(commentId);
  if (res.ok) revalidatePath("/p/[short_id]", "page");
  return res;
}

export async function unlikeCommentAction(commentId: string) {
  if (!commentId) return { ok: false as const, error: "Missing commentId" };
  const res = await unlikeComment(commentId);
  if (res.ok) revalidatePath("/p/[short_id]", "page");
  return res;
}
