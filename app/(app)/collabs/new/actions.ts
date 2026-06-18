"use server";

import { redirect } from "next/navigation";
import { createProject } from "@/lib/db/projects";

export async function createProjectAction(formData: FormData): Promise<{ error?: string }> {
  const title = (formData.get("title") as string)?.trim();
  const brief = (formData.get("brief") as string)?.trim();
  const deliverable = (formData.get("deliverable") as string)?.trim();
  const deadline = (formData.get("deadline") as string)?.trim();
  const slotRaw = formData.get("slot_count") as string;
  const slot_count = Math.min(8, Math.max(1, parseInt(slotRaw, 10) || 1));

  if (!title || !brief || !deliverable || !deadline) {
    return { error: "All fields are required." };
  }

  const result = await createProject({ title, brief, deliverable, deadline, slot_count });

  if (!result.ok) {
    return { error: result.error ?? "Failed to create project." };
  }

  redirect(`/c/${result.shortId}`);
}
