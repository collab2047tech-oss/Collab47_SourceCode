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
  // Build the payload from ONLY the fields the submitted form actually carries.
  // The Settings page has two separate forms (Profile + Academic) that share
  // this action; including absent fields as "" would wipe data (e.g. submitting
  // the Academic form would blank out the user's name). FormData.has() lets us
  // update exactly what was sent.
  const payload: Parameters<typeof updateProfile>[0] = {};

  if (formData.has("name")) {
    payload.name = (formData.get("name") as string | null)?.trim() ?? "";
  }
  if (formData.has("college")) {
    payload.college = (formData.get("college") as string | null)?.trim() ?? "";
  }
  if (formData.has("branch")) {
    payload.branch = (formData.get("branch") as string | null)?.trim() ?? "";
  }
  if (formData.has("year_of_study")) {
    payload.year_of_study = (formData.get("year_of_study") as string | null)?.trim() ?? "";
  }

  // Only forward handle when the form carries a non-empty value. The Account
  // section validates/saves it (uniqueness + format) in updateProfile.
  const handleRaw = (formData.get("handle") as string | null)?.trim().toLowerCase();
  if (handleRaw) payload.handle = handleRaw;

  const result = await updateProfile(payload);
  if (!result.ok) return result;

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/u/[handle]", "page");
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

  // Do NOT revalidate /settings - the UI is optimistic and a full re-render adds
  // lag. Revalidate the public profile so the public/private view reflects the
  // new privacy state on the viewer's next visit.
  revalidatePath("/u/[handle]", "page");
  return { ok: true };
}

export async function updateNotificationPrefsAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  // Per-event email/push prefs. `weekly_digest` is intentionally NOT here: the
  // digest is controlled by its own real toggle via updateDigestOptOutAction
  // (profiles.digest_opt_out), not by this placeholder notification_prefs map.
  const keys = [
    "new_follower",
    "direct_messages",
    "branch_news",
    "project_invites",
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

  // Optimistic UI handles the visual state; skip the /settings re-render to keep
  // toggles instant. Prefs are persisted for when email/push are wired.
  return { ok: true };
}

export async function updateDigestOptOutAction(
  optOut: boolean
): Promise<{ ok: boolean; error?: string }> {
  // Weekly-digest opt-out for the LOGGED-IN user. This writes the SAME
  // `profiles.digest_opt_out` flag the emailed one-click unsubscribe link sets
  // (app/api/unsubscribe), but from an authenticated session instead of a signed
  // token. `runWeeklyDigest` (lib/email/digest.ts) only sends to profiles where
  // digest_opt_out = false, so this is the real, honest control - not a
  // placeholder. RLS `profiles_write_own` (auth.uid() = id) scopes the write to
  // the user's own row; the 0040 column guard only reverts verified/suspended_at,
  // so this column is freely user-writable (same path as updatePrivacy).
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await sb
    .from("profiles")
    .update({ digest_opt_out: optOut })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAccountAction(): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteMyAccount();
  if (!result.ok) return result;
  // Sign the user out immediately so the soft-deleted session does not linger.
  // The account stays restorable for 14 days by signing back in (the purge cron
  // hard-deletes after that). The client then redirects to "/".
  const sb = await getSupabaseServer();
  if (sb) await sb.auth.signOut();
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const sb = await getSupabaseServer();
  if (sb) await sb.auth.signOut();
  redirect("/");
}
