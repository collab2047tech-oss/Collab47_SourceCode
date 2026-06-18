"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateProfile, uploadProfileImage } from "@/lib/db/profiles";

export async function updateProfileAction(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const bio = (formData.get("bio") as string | null)?.trim() ?? "";
  const college = (formData.get("college") as string | null)?.trim() ?? "";
  const branch = (formData.get("branch") as string | null)?.trim() ?? "";
  const year_of_study = (formData.get("year_of_study") as string | null)?.trim() ?? "";
  const city = (formData.get("city") as string | null)?.trim() ?? "";

  const avatarFile = formData.get("avatar") as File | null;
  const coverFile = formData.get("cover") as File | null;

  let avatar_url: string | undefined;
  let cover_url: string | undefined;

  if (avatarFile && avatarFile.size > 0) {
    const result = await uploadProfileImage(avatarFile, "avatar");
    if (result.ok && result.url) avatar_url = result.url;
  }

  if (coverFile && coverFile.size > 0) {
    const result = await uploadProfileImage(coverFile, "cover");
    if (result.ok && result.url) cover_url = result.url;
  }

  const payload: Parameters<typeof updateProfile>[0] = {
    name,
    bio,
    college,
    branch,
    year_of_study,
    city,
  };
  if (avatar_url) payload.avatar_url = avatar_url;
  if (cover_url) payload.cover_url = cover_url;

  const result = await updateProfile(payload);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/profile");
  revalidatePath("/u/[handle]");
  redirect("/profile");
}
