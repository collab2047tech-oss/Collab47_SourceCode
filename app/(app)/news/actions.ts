"use server";

import { revalidatePath } from "next/cache";
import {
  reactToNews,
  addNewsComment,
  reportNews,
  setNewsSaved,
  setNewsTopicSignal,
  type NewsReactionKind,
  type NewsComment,
} from "@/lib/db/newsEngage";

export async function reactToNewsAction(
  newsId: string,
  kind: NewsReactionKind | null
): Promise<{ ok: boolean; error?: string }> {
  const res = await reactToNews(newsId, kind);
  // NOTE: do NOT revalidate "/news" here. The InShorts feed keeps its state
  // optimistically on the client; revalidating the feed route would refetch +
  // remount the whole list, reset client state, and re-shuffle the order -
  // making the card the user just acted on appear to "jump" or vanish. The
  // detail page is optimistic too, so a revalidate there is unnecessary.
  return res;
}

// Save / unsave a news item. Fire-and-forget from the client (optimistic) - no
// revalidate so the InShorts loop never remounts.
export async function setNewsSavedAction(
  newsId: string,
  next: boolean
): Promise<{ ok: boolean; error?: string }> {
  return setNewsSaved(newsId, next);
}

// Durable "More like this" / "Less like this". Persists a per-user topic
// affinity signal that informs server ranking on the NEXT visit (cross-device).
// No revalidate - the client already updated its local loop instantly.
export async function setNewsTopicSignalAction(
  newsId: string,
  dir: "more" | "less"
): Promise<{ ok: boolean; error?: string }> {
  return setNewsTopicSignal(newsId, dir);
}

// Optimistic comment submission. Returns ok/error to the client so it can
// reconcile its optimistic prepend. No revalidate - the client owns the list.
export async function addNewsCommentAction(
  newsId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; comment?: NewsComment }> {
  const body = formData.get("body")?.toString() ?? "";
  return addNewsComment(newsId, body);
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
