"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  createPost,
  deletePost,
  pinPost,
  unpinPost,
  convertRepostToHighlight,
} from "@/lib/db/posts";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/supabase/env";
import { moderateContent } from "@/lib/moderation/moderate";

// ---------------------------------------------------------------------------
// Media upload helper
// ---------------------------------------------------------------------------

/**
 * Upload a single File to the given storage bucket.
 * Returns the public URL on success, or null on failure.
 * Uses the server Supabase client (authenticated user session via cookies).
 */
export async function uploadMedia(
  file: File,
  userId: string,
  bucket = "post-media"
): Promise<string | null> {
  if (!supabaseConfigured) return null;

  const sb = await getSupabaseServer();
  if (!sb) return null;

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("[uploadMedia]", error.message);
    return null;
  }

  const {
    data: { publicUrl },
  } = sb.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

// ---------------------------------------------------------------------------
// Post actions
// ---------------------------------------------------------------------------

export async function createPostAction(
  formData: FormData
): Promise<{ ok: boolean; postId?: string; shortId?: string; error?: string }> {
  if (!supabaseConfigured) {
    return { ok: false, error: "Database not connected." };
  }

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured." };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const body = (formData.get("body") as string | null)?.trim() ?? "";
  if (!body) return { ok: false, error: "Post body is required." };
  if (body.length > 2000) return { ok: false, error: "Post body exceeds 2000 characters." };

  const moderationResult = await moderateContent(body);
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }

  const hashtagsRaw = (formData.get("hashtags") as string | null) ?? "";
  // Lowercase, strip leading '#', cap each tag to 40 chars, de-dupe, and cap
  // the array to 15 entries to guard against storage bloat/abuse.
  const seenTags = new Set<string>();
  const hashtags: string[] = [];
  for (const raw of hashtagsRaw.split(" ")) {
    const t = raw.replace(/^#/, "").toLowerCase().slice(0, 40);
    if (!t || seenTags.has(t)) continue;
    seenTags.add(t);
    hashtags.push(t);
    if (hashtags.length >= 15) break;
  }

  // Media is uploaded CLIENT-SIDE directly to Supabase Storage (so large files
  // never pass through this Server Action's 1MB body limit). We receive URLs.
  let image_urls: string[] = [];
  const imageUrlsRaw = formData.get("image_urls") as string | null;
  if (imageUrlsRaw) {
    try {
      const parsed = JSON.parse(imageUrlsRaw);
      if (Array.isArray(parsed)) {
        image_urls = parsed.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 5);
      }
    } catch {
      /* ignore malformed input */
    }
  }

  const videoUrlRaw = (formData.get("video_url") as string | null)?.trim() ?? "";
  const video_url = videoUrlRaw.length > 0 ? videoUrlRaw : null;

  // Only one media type per post.
  if (image_urls.length > 0 && video_url) {
    return { ok: false, error: "Attach images or a video, not both." };
  }

  const result = await createPost({
    body,
    image_urls,
    video_url,
    hashtags,
    branch_tags: [],
    city_tags: [],
  });

  // No revalidatePath("/home"): the composer inserts the new post optimistically
  // into the client feed and reconciles with the returned id/short_id. A full
  // /home revalidation would re-run the ranker and clobber the optimistic list.
  return result;
}

export async function deletePostAction(
  postId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await deletePost(postId);
  if (result.ok) {
    revalidatePath("/home");
  }
  return result;
}

export async function pinPostAction(
  postId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await pinPost(postId);
  if (result.ok) {
    revalidatePath("/profile");
    revalidatePath("/u/[handle]");
  }
  return result;
}

export async function unpinPostAction(
  postId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await unpinPost(postId);
  if (result.ok) {
    revalidatePath("/profile");
    revalidatePath("/u/[handle]");
  }
  return result;
}

/**
 * Save a repost permanently as a highlight (clears the 24h expiry). Only valid
 * for the author's own still-live reposts.
 */
export async function saveHighlightAction(
  postId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await convertRepostToHighlight(postId);
  if (result.ok) {
    revalidatePath("/home");
    revalidatePath("/profile");
    revalidatePath("/u/[handle]");
  }
  return result;
}
