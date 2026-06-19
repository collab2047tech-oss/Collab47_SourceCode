"use server";

import { revalidatePath } from "next/cache";
import { createPost } from "@/lib/db/posts";
import { markProjectDelivered } from "@/lib/db/projects";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function postProgressUpdateAction(
  projectId: string,
  shortId: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  if (!body.trim()) return { ok: false, error: "Update cannot be empty." };
  if (body.length > 2000) return { ok: false, error: "Update must be 2000 characters or fewer." };

  // Only project MEMBERS may post a progress update for the project.
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: membership } = await sb
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Only project members can post updates." };

  const result = await createPost({ body: body.trim(), project_id: projectId });

  if (result.ok) {
    revalidatePath(`/c/${shortId}`);
  }
  return result;
}

export async function markDeliveredAction(
  projectId: string,
  shortId: string,
  deliverableUrl: string
): Promise<{ ok: boolean; error?: string }> {
  if (!deliverableUrl.trim()) return { ok: false, error: "Deliverable URL is required." };

  const result = await markProjectDelivered({ projectId, deliverableUrl: deliverableUrl.trim() });

  if (result.ok) {
    revalidatePath(`/c/${shortId}`);
  }
  return result;
}
