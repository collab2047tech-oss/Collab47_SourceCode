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
  // NOTE: do NOT revalidate "/news" here. The InShorts feed keeps its like
  // state optimistically on the client; revalidating the feed route would
  // refetch + remount the whole list, reset client state, and re-shuffle the
  // order — making the card the user just liked appear to "jump" or vanish.
  // The detail page reaction state is also handled optimistically in
  // NewsActions, so a revalidate there is unnecessary as well.
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
