import { getSupabaseServer } from "@/lib/supabase/server";
import { moderateContent } from "@/lib/moderation/moderate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventKind =
  | "hackathon"
  | "competition"
  | "workshop"
  | "conference"
  | "fest"
  | "talk"
  | "other";

export type EventMode = "online" | "in_person" | "hybrid";

/** Author profile embedded on a listed/fetched event. */
export interface EventAuthor {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
}

export interface EventRow {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  kind: EventKind;
  organizer: string | null;
  mode: EventMode;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  registration_deadline: string | null;
  registration_url: string | null;
  prize: string | null;
  tags: string[];
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
  author?: EventAuthor;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  kind: EventKind;
  organizer?: string | null;
  mode?: EventMode;
  location?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  registration_deadline?: string | null;
  registration_url?: string | null;
  prize?: string | null;
  tags?: string[];
  image_url?: string | null;
}

export type EventListFilter = "upcoming" | "past" | "all";

const VALID_KINDS: readonly EventKind[] = [
  "hackathon",
  "competition",
  "workshop",
  "conference",
  "fest",
  "talk",
  "other",
];

const VALID_MODES: readonly EventMode[] = ["online", "in_person", "hybrid"];

const AUTHOR_SELECT =
  "*, author:profiles!events_author_id_fkey(id,handle,name,avatar_url)";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trim then clamp a free-text field; empty becomes null. */
function clampText(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Validate an http(s) URL; returns the normalized string or null. */
function normalizeUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Lowercase, de-dupe, drop empties, cap at 8. */
function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().toLowerCase().replace(/^#/, "");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t.slice(0, 40));
    if (out.length >= 8) break;
  }
  return out;
}

/** An ISO timestamp string or null (an empty/invalid value becomes null). */
function normalizeDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function isEventKind(value: string | null | undefined): value is EventKind {
  return typeof value === "string" && (VALID_KINDS as readonly string[]).includes(value);
}

function isEventMode(value: string | null | undefined): value is EventMode {
  return typeof value === "string" && (VALID_MODES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert an event owned by the current user. Validates a non-empty title,
 * clamps text fields, validates an http(s) registration URL, and normalizes
 * tags (lowercased, de-duped, max 8). Returns the new event id.
 */
export async function createEvent(
  input: CreateEventInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const title = clampText(input.title, 160);
  if (!title) return { ok: false, error: "A title is required." };

  if (!isEventKind(input.kind)) return { ok: false, error: "Please choose a valid event type." };

  const mode: EventMode = isEventMode(input.mode) ? input.mode : "online";

  // A registration URL is optional, but if provided it must be a real link.
  const registrationUrlRaw = clampText(input.registration_url, 500);
  let registration_url: string | null = null;
  if (registrationUrlRaw) {
    registration_url = normalizeUrl(registrationUrlRaw);
    if (!registration_url) {
      return { ok: false, error: "The registration link must start with http:// or https://" };
    }
  }

  // Moderate the free-text fields before insert - events are world-readable, so
  // mirror the post/comment gate. Cheap fields (title + description + organizer
  // + prize) are checked together in a single pass.
  const description = clampText(input.description, 4000);
  const organizer = clampText(input.organizer, 160);
  const prize = clampText(input.prize, 200);
  const moderationText = [title, description, organizer, prize]
    .filter((v): v is string => Boolean(v))
    .join(" ");
  const moderationResult = await moderateContent(moderationText);
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }

  const { data, error } = await sb
    .from("events")
    .insert({
      author_id: user.id,
      title,
      description,
      kind: input.kind,
      organizer,
      mode,
      location: clampText(input.location, 200),
      starts_at: normalizeDate(input.starts_at),
      ends_at: normalizeDate(input.ends_at),
      registration_deadline: normalizeDate(input.registration_deadline),
      registration_url,
      prize,
      tags: normalizeTags(input.tags),
      image_url: normalizeUrl(input.image_url),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create event." };
  }

  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Discovery listing. Never returns soft-deleted rows.
 *  - "upcoming": registration still open OR the event itself is in the future
 *                (registration_deadline >= now OR starts_at >= now), soonest first.
 *  - "past":     already started (starts_at < now), most recent first.
 *  - "all":      everything, soonest upcoming first then newest.
 */
export async function listEvents(opts: {
  filter?: EventListFilter;
  kind?: string;
  limit?: number;
} = {}): Promise<EventRow[]> {
  const { filter = "upcoming", kind, limit = 24 } = opts;
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const nowIso = new Date().toISOString();

  let query = sb.from("events").select(AUTHOR_SELECT).is("deleted_at", null).limit(limit);

  if (filter === "upcoming") {
    query = query
      .or(`registration_deadline.gte.${nowIso},starts_at.gte.${nowIso}`)
      .order("starts_at", { ascending: true, nullsFirst: false });
  } else if (filter === "past") {
    query = query.lt("starts_at", nowIso).order("starts_at", { ascending: false });
  } else {
    query = query.order("starts_at", { ascending: true, nullsFirst: false });
  }

  if (kind && isEventKind(kind)) {
    query = query.eq("kind", kind);
  }

  const { data } = await query;
  return (data ?? []) as unknown as EventRow[];
}

/** A single live event with its author, or null if missing/deleted. */
export async function getEventById(id: string): Promise<EventRow | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;

  const { data } = await sb
    .from("events")
    .select(AUTHOR_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  return (data as unknown as EventRow) ?? null;
}
