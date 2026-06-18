"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function markNotInterestedAction(postId: string) {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("user_feed_feedback").insert({
    user_id: user.id, post_id: postId, signal: "not_interested",
  });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true };
}

export async function markShowFewerLikeThisAction(postId: string, topHashtag?: string) {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("user_feed_feedback").insert({
    user_id: user.id, post_id: postId, signal: "tag_downvote",
    meta: topHashtag ? { tag: topHashtag } : {},
  });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true };
}

export async function updateFeedFiltersAction(filters: {
  only_follows: boolean;
  hide_news: boolean;
  hide_projects: boolean;
}) {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("profiles").update({ feed_prefs: filters }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true };
}
