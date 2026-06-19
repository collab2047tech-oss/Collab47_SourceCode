import { getSupabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/lib/supabase/types";

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("*").eq("handle", handle).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function upsertOnboardingProfile(payload: {
  handle: string;
  name: string;
  college: string;
  branch: string;
  year_of_study: string;
  city: string;
  birthdate: string | null;
  interests: string[];
}) {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Handle must be unique; surface a friendly error if taken by someone else.
  const { data: clash } = await sb
    .from("profiles")
    .select("id")
    .eq("handle", payload.handle)
    .neq("id", user.id)
    .maybeSingle();
  if (clash) return { ok: false, error: "That username is taken. Pick another." };

  const { error } = await sb.from("profiles").upsert({
    id: user.id,
    ...payload,
    birthdate: payload.birthdate || null,
    onboarded: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile update
// ---------------------------------------------------------------------------

export async function updateProfile(payload: {
  name?: string;
  bio?: string;
  college?: string;
  branch?: string;
  year_of_study?: string;
  city?: string;
  avatar_url?: string;
  cover_url?: string;
  /** Optional: new handle. Validated for format and uniqueness before saving. */
  handle?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Validate and check uniqueness of handle if provided.
  const { handle, ...rest } = payload;
  const updateFields: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };

  if (handle !== undefined) {
    if (!/^[a-z0-9_]{3,32}$/.test(handle)) {
      return { ok: false, error: "Handle must be 3–32 lowercase letters, digits, or underscores." };
    }
    const { data: clash } = await sb
      .from("profiles")
      .select("id")
      .eq("handle", handle)
      .neq("id", user.id)
      .maybeSingle();
    if (clash) return { ok: false, error: "That handle is already taken. Pick another." };
    updateFields.handle = handle;
  }

  const { error } = await sb
    .from("profiles")
    .update(updateFields)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Privacy settings
// ---------------------------------------------------------------------------

export async function updatePrivacy(payload: {
  public_profile?: boolean;
  searchable?: boolean;
  read_receipts?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Fetch current privacy value and merge so existing keys are preserved.
  const { data: current } = await sb
    .from("profiles")
    .select("privacy")
    .eq("id", user.id)
    .maybeSingle();

  const merged = { ...(current?.privacy as Record<string, unknown> ?? {}), ...payload };

  const { error } = await sb
    .from("profiles")
    .update({ privacy: merged })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export async function updateNotificationPrefs(
  prefs: Record<string, { email: boolean; push: boolean }>
): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Fetch current notification_prefs and merge so existing keys are preserved.
  const { data: current } = await sb
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .maybeSingle();

  const merged = {
    ...(current?.notification_prefs as Record<string, { email: boolean; push: boolean }> ?? {}),
    ...prefs,
  };

  const { error } = await sb
    .from("profiles")
    .update({ notification_prefs: merged })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Account deletion (soft delete, 14-day cooling period)
// ---------------------------------------------------------------------------

export async function deleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await sb
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile image upload (server-only)
// ---------------------------------------------------------------------------

export async function uploadProfileImage(
  file: File,
  kind: "avatar" | "cover"
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!supabaseConfigured) return { ok: true, url: undefined };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const ext = file.name.split(".").pop() ?? "jpg";
  const bucket = kind === "avatar" ? "avatars" : "covers";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: true });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(path);
  return { ok: true, url: publicUrl };
}
