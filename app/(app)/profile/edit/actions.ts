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
  // Explicit removal: the user cleared their avatar without picking a new one.
  const avatarRemoved = formData.get("avatar_removed") === "true";
  // Banner: a preset id (empty = an uploaded cover is used) + the uploaded
  // cover's focal point. cover_removed fires when the user switched to a preset.
  const banner_preset = (formData.get("banner_preset") as string | null)?.trim() ?? null;
  const coverRemoved = formData.get("cover_removed") === "true";
  const focalRaw = {
    x: Number(formData.get("cover_focal_x")),
    y: Number(formData.get("cover_focal_y")),
  };
  const clampFocal = (n: number) =>
    Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 50;

  // Social links plumbing - DISABLED in lockstep with the hidden Links card in
  // ProfileEditForm. If this ran while the form fields are hidden, every field
  // would read as "" and saving a profile would ERASE the user's stored links.
  // Restore this together with the form block, never separately.
  // const linkField = (key: string) =>
  //   (formData.get(`link_${key}`) as string | null)?.trim() ?? "";
  // const links: Record<string, string> = {
  //   website: linkField("website"),
  //   github: linkField("github"),
  //   linkedin: linkField("linkedin"),
  //   instagram: linkField("instagram"),
  //   twitter: linkField("twitter"),
  //   youtube: linkField("youtube"),
  // };

  const payload: Parameters<typeof updateProfile>[0] = {
    name,
    bio,
    college,
    branch,
    year_of_study,
    city,
  };
  if (avatar_url) payload.avatar_url = avatar_url;
  else if (avatarRemoved) payload.avatar_url = ""; // clear the saved avatar

  // Banner: preset and uploaded cover are mutually exclusive.
  if (banner_preset) {
    // A preset was chosen -> store it and clear any uploaded cover.
    payload.banner_preset = banner_preset;
    payload.cover_url = "";
  } else {
    // Upload mode -> no preset, keep/replace the cover + persist the focal point.
    payload.banner_preset = "";
    if (cover_url) payload.cover_url = cover_url;
    else if (coverRemoved) payload.cover_url = "";
    payload.cover_focal_x = clampFocal(focalRaw.x);
    payload.cover_focal_y = clampFocal(focalRaw.y);
  }

  // Honorific title (Mr/Dr/...). Read ONLY when the field is present, so the
  // legacy full-page editor (which has no title field) never blanks a stored
  // honorific. Attached at runtime; updateProfile persists it via its `...rest`
  // passthrough. Empty -> null to match the onboarding convention.
  if (formData.has("title")) {
    const t = (formData.get("title") as string | null)?.trim() ?? "";
    (payload as Record<string, unknown>).title = t === "" ? null : t;
  }

  const result = await updateProfile(payload);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/profile");
  revalidatePath("/u/[handle]");
  redirect("/profile");
}
