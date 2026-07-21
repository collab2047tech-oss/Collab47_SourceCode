"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

export type ImageBucket = "avatars" | "covers";

/**
 * Upload a File to a Storage bucket and return its public URL.
 *
 * This is the SAME upload path used by components/composite/ProfileEditForm.tsx
 * (`uploadImage` there), extracted into one shared helper so the inline avatar
 * and banner editors reuse the exact bucket/path/cacheControl behaviour that
 * already works. Storage buckets ("avatars" | "covers") pre-exist; nothing about
 * the storage contract changes here.
 */
export async function uploadImage(
  sb: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
  userId: string,
  file: File,
  bucket: ImageBucket,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
