"use server";

import { revalidatePath } from "next/cache";
import {
  reactToNews,
  addNewsComment,
  reportNews,
  type NewsReactionKind,
} from "@/lib/db/newsEngage";

export async function reactToNewsAction(
  newsId: string,
  kind: NewsReactionKind | null
): Promise<{ ok: boolean; error?: string }> {
  const res = await reactToNews(newsId, kind);
  if (res.ok) {
    revalidatePath(`/news/${newsId}`);
    revalidatePath("/news");
  }
  return res;
}

export async function addNewsCommentAction(
  newsId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const body = formData.get("body")?.toString() ?? "";
  const res = await addNewsComment(newsId, body);
  if (res.ok) revalidatePath(`/news/${newsId}`);
  return res;
}

export async function reportNewsAction(
  newsId: string,
  category: "spam" | "hate" | "sexual" | "other",
  detail?: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await reportNews(newsId, category, detail);
  if (res.ok) revalidatePath(`/news/${newsId}`);
  return res;
}
