"use server";

import { revalidatePath } from "next/cache";
import { addComment } from "@/lib/db/engagement";

export async function addCommentOnPostAction(formData: FormData) {
  const postId = formData.get("postId")?.toString() ?? "";
  const body = formData.get("body")?.toString() ?? "";
  const parentCommentId = formData.get("parentCommentId")?.toString() || null;
  if (!postId) return { ok: false as const, error: "Missing postId" };
  const res = await addComment({ postId, body, parentCommentId });
  if (res.ok) revalidatePath(`/p`);
  return res;
}
