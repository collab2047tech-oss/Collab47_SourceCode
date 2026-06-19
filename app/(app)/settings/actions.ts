"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  updateProfile,
  updatePrivacy,
  updateNotificationPrefs,
  deleteMyAccount,
} from "@/lib/db/profiles";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function updateAccountAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const college = (formData.get("college") as string | null)?.trim() ?? "";
  const branch = (formData.get("branch") as string | null)?.trim() ?? "";
  const year_of_study = (formData.get("year_of_study") as string | null)?.trim() ?? "";
  const handleRaw = (formData.get("handle") as string | null)?.trim().toLowerCase();

  const payload: Parameters<typeof updateProfile>[0] = { name, college, branch, year_of_study };
  // Only forward handle when the form actually carries it (the Account section does).
  if (handleRaw) payload.handle = handleRaw;

  const result = await updateProfile(payload);
  if (!result.ok) return result;

  revalidatePath("/settings");
  return { ok: true };
}

export async function updatePrivacyAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const public_profile = formData.get("public_profile") === "true";
  const searchable = formData.get("searchable") === "true";
  const read_receipts = formData.get("read_receipts") === "true";

  const result = await updatePrivacy({ public_profile, searchable, read_receipts });
  if (!result.ok) return result;

  revalidatePath("/settings");
  return { ok: true };
}

export async function updateNotificationPrefsAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const keys = [
    "new_follower",
    "direct_messages",
    "branch_news",
    "project_invites",
    "weekly_digest",
  ];

  const prefs: Record<string, { email: boolean; push: boolean }> = {};
  for (const key of keys) {
    prefs[key] = {
      email: formData.get(`${key}_email`) === "true",
      push: formData.get(`${key}_push`) === "true",
    };
  }

  const result = await updateNotificationPrefs(prefs);
  if (!result.ok) return result;

  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteAccountAction(): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteMyAccount();
  if (!result.ok) return result;
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const sb = await getSupabaseServer();
  if (sb) await sb.auth.signOut();
  redirect("/");
}
