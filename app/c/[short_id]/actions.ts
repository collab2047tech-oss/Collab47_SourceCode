"use server";

import { revalidatePath } from "next/cache";
import {
  applyToProject,
  acceptApplicant,
  rejectApplicant,
} from "@/lib/db/projects";
import { getOrCreate1to1Conversation } from "@/lib/db/messages";

export async function applyToProjectAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const projectId = formData.get("projectId") as string;
  const pitch = (formData.get("pitch") as string) ?? "";
  const linksRaw = (formData.get("links") as string) ?? "";
  const shortId = formData.get("shortId") as string;

  const links = linksRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);

  const result = await applyToProject({ projectId, pitch, links });

  if (result.ok && shortId) {
    revalidatePath(`/c/${shortId}`);
  }

  return result;
}

export async function acceptApplicantAction(
  projectId: string,
  applicantId: string,
  shortId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await acceptApplicant({ projectId, applicantId });
  if (result.ok) {
    revalidatePath(`/c/${shortId}`);
  }
  return result;
}

export async function rejectApplicantAction(
  projectId: string,
  applicantId: string,
  shortId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await rejectApplicant({ projectId, applicantId });
  if (result.ok) {
    revalidatePath(`/c/${shortId}`);
  }
  return result;
}

export async function messageApplicantAction(
  applicantId: string
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const result = await getOrCreate1to1Conversation(applicantId);
  return result;
}
