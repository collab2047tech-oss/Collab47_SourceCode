"use server";

import { redirect } from "next/navigation";
import { createProject, type CreateProjectField } from "@/lib/db/projects";
import type { ProjectRole } from "@/lib/supabase/types";

export interface CreateProjectInput {
  title: string;
  brief: string;
  deliverable: string;
  category: string | null;
  roles: ProjectRole[];
  commitmentHours: number | null;
  duration: string | null;
}

/**
 * Structured project creation. Takes a serializable object (not FormData) so the
 * wizard can send the roles array as-is. On success it redirects to the new
 * project; on a validation failure it RETURNS { error, field } so the wizard can
 * keep every field on screen and jump the user back to the offending step -
 * never a redirect-wipe (same contract as the onboarding action).
 */
export async function createProjectAction(
  input: CreateProjectInput,
): Promise<{ error?: string; field?: CreateProjectField }> {
  const title = (input?.title ?? "").trim();
  const brief = (input?.brief ?? "").trim();
  const deliverable = (input?.deliverable ?? "").trim();

  // Cheap presence checks first for friendly, field-keyed messages. The DB layer
  // re-validates every floor authoritatively (min lengths, >=1 role, category).
  if (title.length < 8) {
    return { error: "Give your project a clear title of at least 8 characters.", field: "title" };
  }
  if (brief.length < 140) {
    return { error: "The brief needs at least 140 characters so applicants understand the work.", field: "brief" };
  }
  if (!deliverable) {
    return { error: "Describe what the team will deliver.", field: "deliverable" };
  }
  if (!Array.isArray(input?.roles) || input.roles.length === 0) {
    return { error: "Add at least one role you need on the team.", field: "roles" };
  }

  const result = await createProject({
    title,
    brief,
    deliverable,
    category: input.category ?? null,
    roles: input.roles,
    commitmentHours: input.commitmentHours ?? null,
    duration: input.duration ?? null,
  });

  if (!result.ok) {
    return { error: result.error ?? "Failed to create project.", field: result.field };
  }

  redirect(`/c/${result.shortId}`);
}
