"use server";

import { revalidatePath } from "next/cache";
import {
  likePost, unlikePost,
  reactToPost,
  addComment, deleteComment,
  repostPost, removeRepost,
  bookmarkPost, unbookmarkPost,
  type ReactionKind,
} from "@/lib/db/engagement";

export async function likePostAction(postId: string) {
  const res = await likePost(postId);
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function reactToPostAction(postId: string, reaction: ReactionKind) {
  const res = await reactToPost(postId, reaction);
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function unlikePostAction(postId: string) {
  const res = await unlikePost(postId);
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function addCommentAction(formData: FormData) {
  const postId = formData.get("postId")?.toString() ?? "";
  const body = formData.get("body")?.toString() ?? "";
  const parentCommentId = formData.get("parentCommentId")?.toString() || null;
  if (!postId) return { ok: false as const, error: "Missing postId" };
  const res = await addComment({ postId, body, parentCommentId });
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function deleteCommentAction(commentId: string) {
  const res = await deleteComment(commentId);
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function repostPostAction(originalPostId: string) {
  const res = await repostPost({ originalPostId });
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function removeRepostAction(repostPostId: string) {
  const res = await removeRepost(repostPostId);
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function bookmarkPostAction(postId: string) {
  const res = await bookmarkPost(postId);
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function unbookmarkPostAction(postId: string) {
  const res = await unbookmarkPost(postId);
  if (res.ok) revalidatePath("/home");
  return res;
}
