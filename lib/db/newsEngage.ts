import { getSupabaseServer } from "@/lib/supabase/server";
import { moderateContent } from "@/lib/moderation/moderate";

export type NewsReactionKind = "like" | "dislike";

export interface NewsComment {
  id: string;
  news_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: {
    handle: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

// Upsert or clear a reaction. Pass null/undefined kind to remove the reaction.
export async function reactToNews(
  newsId: string,
  kind: NewsReactionKind | null
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (!kind) {
    const { error } = await sb
      .from("news_reactions")
      .delete()
      .eq("user_id", user.id)
      .eq("news_id", newsId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await sb
    .from("news_reactions")
    .upsert(
      { user_id: user.id, news_id: newsId, kind },
      { onConflict: "user_id,news_id" }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMyNewsReaction(
  newsId: string
): Promise<NewsReactionKind | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .from("news_reactions")
    .select("kind")
    .eq("user_id", user.id)
    .eq("news_id", newsId)
    .maybeSingle();

  return (data?.kind as NewsReactionKind) ?? null;
}

export async function addNewsComment(
  newsId: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const trimmed = body.slice(0, 600).trim();
  if (!trimmed) return { ok: false, error: "Comment cannot be empty" };

  const modResult = await moderateContent(trimmed);
  if (!modResult.ok) {
    return { ok: false, error: modResult.reason ?? "Content not allowed" };
  }

  const { error } = await sb
    .from("news_comments")
    .insert({ news_id: newsId, author_id: user.id, body: trimmed });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getNewsComments(newsId: string): Promise<NewsComment[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data, error } = await sb
    .from("news_comments")
    .select("id, news_id, author_id, body, created_at, author:profiles!news_comments_author_id_fkey(handle, name, avatar_url)")
    .eq("news_id", newsId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as NewsComment[];
}

export async function reportNews(
  newsId: string,
  category: "spam" | "hate" | "sexual" | "other",
  detail?: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await sb.from("reports").insert({
    reporter_id: user.id,
    news_id: newsId,
    category,
    body: detail?.slice(0, 300) ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
