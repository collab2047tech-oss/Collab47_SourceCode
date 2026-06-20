"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateProfile } from "@/lib/db/profiles";

export async function updateProfileAction(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const bio = (formData.get("bio") as string | null)?.trim() ?? "";
  const college = (formData.get("college") as string | null)?.trim() ?? "";
  const branch = (formData.get("branch") as string | null)?.trim() ?? "";
  const year_of_study = (formData.get("year_of_study") as string | null)?.trim() ?? "";
  const city = (formData.get("city") as string | null)?.trim() ?? "";

  // Images uploaded client-side to Storage; action only receives URLs.
  const avatar_url = (formData.get("avatar_url") as string | null)?.trim() || undefined;
  const cover_url = (formData.get("cover_url") as string | null)?.trim() || undefined;

  // Social links. Always send the object so cleared fields are persisted as removed.
  const linkField = (key: string) =>
    (formData.get(`link_${key}`) as string | null)?.trim() ?? "";
  const links: Record<string, string> = {
    website: linkField("website"),
    github: linkField("github"),
    linkedin: linkField("linkedin"),
    instagram: linkField("instagram"),
    twitter: linkField("twitter"),
    youtube: linkField("youtube"),
  };

  const payload: Parameters<typeof updateProfile>[0] = {
    name,
    bio,
    college,
    branch,
    year_of_study,
    city,
    links,
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
