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
): Promise<{ ok: boolean; error?: string; comment?: NewsComment }> {
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

  // Return the inserted row (with its author) so the client can reconcile its
  // optimistic placeholder against the real id/author instead of leaving the
  // temp "me"/null author that renders as "Unknown" until a refresh.
  const { data, error } = await sb
    .from("news_comments")
    .insert({ news_id: newsId, author_id: user.id, body: trimmed })
    .select("id, news_id, author_id, body, created_at, author:profiles!news_comments_author_id_fkey(handle, name, avatar_url)")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not post comment" };
  return { ok: true, comment: data as unknown as NewsComment };
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

// ---------------------------------------------------------------------------
// Save / bookmark a news item (the meaningful "keep" signal, replaces voting).
// ---------------------------------------------------------------------------

export async function isNewsSaved(newsId: string): Promise<boolean> {
  const sb = await getSupabaseServer();
  if (!sb) return false;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb
    .from("news_saves")
    .select("news_id")
    .eq("user_id", user.id)
    .eq("news_id", newsId)
    .maybeSingle();
  return Boolean(data);
}

// Toggle save on/off. `next` true = save, false = unsave. Also logs a news_event.
export async function setNewsSaved(
  newsId: string,
  next: boolean
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (next) {
    const { error } = await sb
      .from("news_saves")
      // ignoreDuplicates: re-saving is a no-op insert (news_saves has no UPDATE
      // policy, so an on-conflict UPDATE would RLS-fail). Saving twice is fine.
      .upsert({ user_id: user.id, news_id: newsId }, { onConflict: "user_id,news_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
    await sb.from("news_events").insert({ user_id: user.id, news_id: newsId, kind: "save" });
  } else {
    const { error } = await sb
      .from("news_saves")
      .delete()
      .eq("user_id", user.id)
      .eq("news_id", newsId);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Durable per-user topic affinity ("More like this" / "Less like this").
// Bridges the instant localStorage loop to the cross-device classical engine.
// ---------------------------------------------------------------------------

export async function setNewsTopicSignal(
  newsId: string,
  dir: "more" | "less"
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Look up the item's reader-facing topics.
  const { data: item } = await sb
    .from("news_items")
    .select("topics")
    .eq("id", newsId)
    .maybeSingle();
  const topics = ((item?.topics as string[] | null) ?? []).filter(Boolean);

  const delta = dir === "more" ? 1 : -0.5;

  // Read existing weights so we can clamp the upsert.
  if (topics.length > 0) {
    const { data: existing } = await sb
      .from("news_topic_affinity")
      .select("topic, weight")
      .eq("user_id", user.id)
      .in("topic", topics);
    const current = new Map<string, number>(
      ((existing as Array<{ topic: string; weight: number }> | null) ?? []).map((r) => [r.topic, r.weight])
    );
    const updatedAt = new Date().toISOString();
    const upserts = topics.map((topic) => {
      const prev = current.get(topic) ?? 0;
      const weight = Math.max(-5, Math.min(10, prev + delta));
      return { user_id: user.id, topic, weight, updated_at: updatedAt };
    });
    const { error } = await sb
      .from("news_topic_affinity")
      .upsert(upserts, { onConflict: "user_id,topic" });
    if (error) return { ok: false, error: error.message };
  }

  // Behaviour log (fire-and-forget; never blocks the optimistic UI).
  await sb.from("news_events").insert({ user_id: user.id, news_id: newsId, kind: dir });
  return { ok: true };
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
