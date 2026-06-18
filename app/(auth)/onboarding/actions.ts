"use server";

import { upsertOnboardingProfile } from "@/lib/db/profiles";
import { redirect } from "next/navigation";

// Used directly as a <form action>. Must resolve to void.
// Validation failures fall through to a safe default handle so onboarding
// never dead-ends; richer inline validation lives in a future step UI.
export async function completeOnboarding(formData: FormData): Promise<void> {
  let handle = (formData.get("handle") ?? "").toString().toLowerCase().trim();
  let name = (formData.get("name") ?? "").toString().trim();
  const college = (formData.get("college") ?? "").toString().trim();
  const branch = (formData.get("branch") ?? "").toString().trim();
  const year_of_study = (formData.get("year_of_study") ?? "").toString().trim();
  const interestsRaw = formData.getAll("interests").map((x) => x.toString());

  if (!handle.match(/^[a-z0-9_]{3,32}$/)) {
    handle = "user" + Math.floor(Math.random() * 1_000_000);
  }
  if (!name) name = "Collab47 user";

  await upsertOnboardingProfile({
    handle, name, college, branch, year_of_study, interests: interestsRaw.slice(0, 5),
  });
  redirect("/home");
}
