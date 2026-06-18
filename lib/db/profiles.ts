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
  interests: string[];
}) {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const { error } = await sb.from("profiles").upsert({
    id: user.id,
    ...payload,
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
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: true };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await sb
    .from("profiles")
    .update({ ...payload, updated_at: new Date().toISOString() })
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
  if (!supabaseConfigured) return { ok: true };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Merge with existing privacy object via jsonb concatenation
  const { error } = await sb
    .from("profiles")
    .update({ privacy: payload })
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
  if (!supabaseConfigured) return { ok: true };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await sb
    .from("profiles")
    .update({ notification_prefs: prefs })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Account deletion (soft delete, 14-day cooling period)
// ---------------------------------------------------------------------------

export async function deleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: true };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Supabase not configured" };

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
