"use server";

import { redirect } from "next/navigation";
import { createProject } from "@/lib/db/projects";

export async function createProjectAction(formData: FormData): Promise<{ error?: string }> {
  const title = (formData.get("title") as string)?.trim();
  const brief = (formData.get("brief") as string)?.trim();
  const deliverable = (formData.get("deliverable") as string)?.trim();
  const deadline = (formData.get("deadline") as string)?.trim();

  if (!title || !brief || !deliverable || !deadline) {
    return { error: "All fields are required." };
  }

  // Slot count is no longer collected from the author (mentor directive): the
  // server sets a standard team size. createProject requires the value and the
  // slot_count column has no DB default, so the default is supplied here. Four
  // collaborators + the owner = the hard 5-member team the "team formed" logic
  // (lib/db/projects.ts effectiveCap = min(slot_count + 1, 5)) caps at.
  const DEFAULT_SLOT_COUNT = 4;

  const result = await createProject({
    title,
    brief,
    deliverable,
    deadline,
    slot_count: DEFAULT_SLOT_COUNT,
  });

  if (!result.ok) {
    return { error: result.error ?? "Failed to create project." };
  }

  redirect(`/c/${result.shortId}`);
}
