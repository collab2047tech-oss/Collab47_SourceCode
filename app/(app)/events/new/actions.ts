"use server";

import { createEvent, type EventKind, type EventMode } from "@/lib/db/events";

/**
 * Parse the new-event form and create the row. Returns the new event id on
 * success (the client form redirects to /events/[id]); returns an error string
 * on failure. Dates arrive as datetime-local strings or empty; tags arrive as a
 * single comma/space-separated field.
 */
export async function createEventAction(
  formData: FormData
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const str = (key: string): string | null => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const tagsRaw = (formData.get("tags") as string | null) ?? "";
  const tags = tagsRaw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return createEvent({
    title: str("title") ?? "",
    description: str("description"),
    kind: (str("kind") as EventKind | null) ?? "other",
    organizer: str("organizer"),
    mode: (str("mode") as EventMode | null) ?? "online",
    location: str("location"),
    starts_at: str("starts_at"),
    ends_at: str("ends_at"),
    registration_deadline: str("registration_deadline"),
    registration_url: str("registration_url"),
    prize: str("prize"),
    tags,
    image_url: str("image_url"),
  });
}
