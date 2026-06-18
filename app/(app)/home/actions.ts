"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  createPost,
  deletePost,
  pinPost,
  unpinPost,
} from "@/lib/db/posts";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/supabase/env";

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
    return { ok: true, postId: "mock-id", shortId: "mock" };
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

  const hashtagsRaw = (formData.get("hashtags") as string | null) ?? "";
  const hashtags = hashtagsRaw
    .split(" ")
    .map((t) => t.replace(/^#/, "").toLowerCase())
    .filter(Boolean);

  // Collect image files (multiple)
  const imageFiles = formData.getAll("images") as File[];
  const validImages = imageFiles.filter((f) => f && f.size > 0).slice(0, 5);

  // Collect video file
  const videoFile = formData.get("video") as File | null;
  const hasVideo = videoFile && videoFile.size > 0;

  // Upload images or video (mutually exclusive)
  let image_urls: string[] = [];
  let video_url: string | null = null;

  if (validImages.length > 0) {
    const uploads = await Promise.all(
      validImages.map((f) => uploadMedia(f, user.id))
    );
    image_urls = uploads.filter((u): u is string => u !== null);
  } else if (hasVideo) {
    video_url = await uploadMedia(videoFile, user.id);
  }

  const result = await createPost({
    body,
    image_urls,
    video_url,
    hashtags,
    branch_tags: [],
    city_tags: [],
  });

  if (result.ok) {
    revalidatePath("/home");
  }

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
