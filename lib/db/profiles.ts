import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { AccountType, Profile } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Change-limit helpers (full name + handle: one change per 7 days)
// ---------------------------------------------------------------------------

/** A name/handle may be changed once every 7 days. */
export const CHANGE_WINDOW_DAYS = 7;
const CHANGE_WINDOW_MS = CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** State of a single rate-limited field, computed from its last-changed stamp. */
export interface ChangeWindow {
  /** True when the field is currently locked (a change happened < 7 days ago). */
  locked: boolean;
  /** ISO timestamp when the field unlocks again, or null if never changed. */
  nextAt: string | null;
}

/**
 * Compute whether a field is changeable now, given its last-changed timestamp.
 * A null timestamp (never changed) is always allowed. The server is the source
 * of truth; the UI uses this purely to render advisory hints.
 */
export function computeChangeWindow(lastAt: string | null | undefined): ChangeWindow {
  if (!lastAt) return { locked: false, nextAt: null };
  const last = new Date(lastAt).getTime();
  if (Number.isNaN(last)) return { locked: false, nextAt: null };
  const next = last + CHANGE_WINDOW_MS;
  if (Date.now() >= next) return { locked: false, nextAt: null };
  return { locked: true, nextAt: new Date(next).toISOString() };
}

/** Format a date as e.g. "Jul 2" using the India locale. No em dashes. */
function formatChangeDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Friendly, exact lockout message for a rate-limited field. */
function changeLimitMessage(field: "name" | "username", nextAt: Date): string {
  const msUntil = nextAt.getTime() - Date.now();
  const daysLeft = Math.max(1, Math.ceil(msUntil / (24 * 60 * 60 * 1000)));
  const dayWord = daysLeft === 1 ? "day" : "days";
  return `You can change your ${field} again in ${daysLeft} ${dayWord} (next change available on ${formatChangeDate(nextAt)}).`;
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("*").eq("handle", handle).maybeSingle();
  return (data as Profile) ?? null;
}

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
});

export async function upsertOnboardingProfile(payload: {
  handle: string;
  name: string;
  account_type: AccountType;
  /** Listed institution or free text. Maps to the `college` column for
   *  student/researcher/faculty (their lab/institution lives here too). */
  college?: string;
  /** Organization / company name for institution + industry account types. */
  organization?: string;
  /** Branch / field / department / industry depending on account type. */
  branch?: string;
  /** Student only. */
  year_of_study?: string;
  /** Role / job title (industry) - persisted into the `branch`-adjacent flow
   *  is avoided; we keep role separate via bio-less mapping into `branch` only
   *  when meaningful. Stored explicitly here for clarity. */
  city?: string;
  birthdate?: string | null;
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

  // Persist only the fields relevant to the chosen account type. Unused
  // columns are written as null so a re-onboard never leaves stale data.
  const row = {
    id: user.id,
    handle: payload.handle,
    name: payload.name,
    account_type: payload.account_type,
    college: payload.college?.trim() || null,
    organization: payload.organization?.trim() || null,
    branch: payload.branch?.trim() || null,
    year_of_study: payload.year_of_study?.trim() || null,
    city: payload.city?.trim() || null,
    birthdate: payload.birthdate || null,
    interests: payload.interests,
    onboarded: true,
  };

  const { error } = await sb.from("profiles").upsert(row);
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
  /** Built-in banner preset id. Empty string clears it (stored as null). */
  banner_preset?: string;
  /** Uploaded-cover focal point, 0..100. */
  cover_focal_x?: number;
  cover_focal_y?: number;
  /** Optional: social links keyed by platform (website/github/linkedin/...). */
  links?: Record<string, string>;
  /** Optional: new handle. Validated for format and uniqueness before saving. */
  handle?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Validate and check uniqueness of handle if provided.
  const { handle, links, banner_preset, ...rest } = payload;
  const now = new Date();
  const updateFields: Record<string, unknown> = { ...rest, updated_at: now.toISOString() };

  // Fetch the current identity fields in one read. Used to (1) detect whether
  // name/handle actually CHANGED (an unchanged value must not consume the
  // 7-day window) and (2) enforce the change limit against the stored stamps.
  const { data: currentRow } = await sb
    .from("profiles")
    .select("name, handle, last_name_change_at, last_handle_change_at")
    .eq("id", user.id)
    .maybeSingle();
  const current = (currentRow ?? null) as {
    name: string | null;
    handle: string | null;
    last_name_change_at: string | null;
    last_handle_change_at: string | null;
  } | null;

  // Name change limit: enforce only when the value actually differs.
  if (rest.name !== undefined) {
    const nextName = rest.name.trim();
    if (current && nextName !== (current.name ?? "")) {
      const win = computeChangeWindow(current.last_name_change_at);
      if (win.locked && win.nextAt) {
        return { ok: false, error: changeLimitMessage("name", new Date(win.nextAt)) };
      }
      updateFields.name = nextName;
      updateFields.last_name_change_at = now.toISOString();
    } else {
      // Unchanged: do not stamp, do not write (keeps the value as-is).
      delete updateFields.name;
    }
  }

  // banner_preset: empty string means "no preset" -> store null so the upload
  // path is unambiguous. A non-empty value is the chosen preset id.
  if (banner_preset !== undefined) {
    updateFields.banner_preset = banner_preset.trim() === "" ? null : banner_preset.trim();
  }
  // cover_url cleared via empty string -> store null (consistent with banner).
  if (rest.cover_url === "") updateFields.cover_url = null;

  // Store only non-empty link values; an empty object clears all links.
  if (links !== undefined) {
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(links)) {
      const v = typeof value === "string" ? value.trim() : "";
      if (v) cleaned[key] = v;
    }
    updateFields.links = cleaned;
  }

  if (handle !== undefined) {
    // Only enforce format / uniqueness / rate-limit when the handle CHANGES.
    if (current && handle !== (current.handle ?? "")) {
      if (!/^[a-z0-9_]{3,32}$/.test(handle)) {
        return { ok: false, error: "Handle must be 3-32 lowercase letters, digits, or underscores." };
      }
      const { data: clash } = await sb
        .from("profiles")
        .select("id")
        .eq("handle", handle)
        .neq("id", user.id)
        .maybeSingle();
      if (clash) return { ok: false, error: "That handle is already taken. Pick another." };

      const win = computeChangeWindow(current.last_handle_change_at);
      if (win.locked && win.nextAt) {
        return { ok: false, error: changeLimitMessage("username", new Date(win.nextAt)) };
      }
      updateFields.handle = handle;
      updateFields.last_handle_change_at = now.toISOString();
    }
    // Unchanged handle: leave it untouched (no stamp, no write).
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

  // Keep the first-class `is_private` column in sync with privacy.public_profile
  // so RLS (which references is_private) and the jsonb stay consistent. When the
  // caller does not touch public_profile, leave is_private untouched.
  const update: Record<string, unknown> = { privacy: merged };
  if (payload.public_profile !== undefined) {
    update.is_private = payload.public_profile === false;
  }

  const { error } = await sb
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Private-profile read gating (Instagram-style)
// ---------------------------------------------------------------------------

/**
 * Whether `viewerId` may see a profile's CONTENT (posts + project details).
 * A public profile is always viewable. A private profile is viewable only by
 * the owner or an accepted connection. This is the server-side gate that runs
 * BEFORE we query posts; RLS (migration 0030) is the deeper defense-in-depth
 * layer that also blocks a direct API bypass.
 *
 * Basics (banner, name, college/role, counts) are always visible per product;
 * only the content list is gated here.
 */
export async function canViewProfileContent(
  viewerId: string | null,
  profile: Pick<Profile, "id" | "privacy">
): Promise<boolean> {
  const isPrivate =
    (profile.privacy as { public_profile?: boolean } | null)?.public_profile === false;
  if (!isPrivate) return true;
  if (viewerId && viewerId === profile.id) return true;
  if (!viewerId) return false;

  const sb = await getSupabaseServer();
  if (!sb) return false;
  // Canonical pair ordering matches the connections table (user_a_id < user_b_id).
  const [a, b] = viewerId < profile.id ? [viewerId, profile.id] : [profile.id, viewerId];
  const { data } = await sb
    .from("connections")
    .select("status")
    .eq("user_a_id", a)
    .eq("user_b_id", b)
    .eq("status", "accepted")
    .maybeSingle();
  return Boolean(data);
}

/**
 * Real counts for the private (and public) profile header, fetched without
 * leaking any content. Uses head:true count queries so no rows are returned -
 * just the aggregate. Connections + projects are world-readable.
 *
 * Posts are counted via the service-role admin client when available so a
 * STRANGER viewing a private profile still sees the TRUE post total (the count
 * is "basic info" per product) while the new posts RLS keeps the post BODIES
 * hidden. We never return any post content here, only the integer.
 */
export async function getPublicProfileCounts(
  profileId: string
): Promise<{ connections: number; posts: number; projects: number }> {
  const sb = await getSupabaseServer();
  if (!sb) return { connections: 0, posts: 0, projects: 0 };

  // Post count via admin client (accurate even for a stranger on a private
  // profile). Falls back to the user-scoped client if the service key is unset.
  const postCounter = getAdminClient() ?? sb;

  const [connRes, postRes, projRes] = await Promise.all([
    sb
      .from("connections")
      .select("user_a_id", { count: "exact", head: true })
      .or(`user_a_id.eq.${profileId},user_b_id.eq.${profileId}`)
      .eq("status", "accepted"),
    postCounter
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", profileId)
      .is("deleted_at", null),
    sb
      .from("project_members")
      .select("project_id", { count: "exact", head: true })
      .eq("user_id", profileId),
  ]);

  return {
    connections: (connRes as { count: number | null }).count ?? 0,
    posts: (postRes as { count: number | null }).count ?? 0,
    projects: (projRes as { count: number | null }).count ?? 0,
  };
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
