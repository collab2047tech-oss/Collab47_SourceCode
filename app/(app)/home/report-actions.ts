"use server";

import { revalidatePath } from "next/cache";
import { submitReport, resolveReport, type ReportCategory } from "@/lib/db/reports";

export async function submitReportAction(formData: FormData) {
  const targetType = (formData.get("targetType")?.toString() ?? "post") as "post" | "profile";
  const targetId = formData.get("targetId")?.toString() ?? "";
  const category = (formData.get("category")?.toString() ?? "spam") as ReportCategory;
  const body = formData.get("body")?.toString() ?? "";

  if (!targetId) return { ok: false, error: "Missing target" };
  if (!["spam", "hate", "sexual", "other"].includes(category)) {
    return { ok: false, error: "Invalid category" };
  }

  const res = await submitReport({ targetType, targetId, category, body });
  if (res.ok) revalidatePath("/home");
  return res;
}

export async function resolveReportAction(
  reportId: string,
  action: "dismiss" | "remove_post" | "suspend_user"
) {
  const res = await resolveReport(reportId, action);
  if (res.ok) revalidatePath("/queue");
  return res;
}
