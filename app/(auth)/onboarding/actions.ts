"use server";

import { upsertOnboardingProfile } from "@/lib/db/profiles";
import { redirect } from "next/navigation";

// Used as a <form action>. Returns void; on validation failure it redirects
// back to onboarding with an ?error= the page can surface.
export async function completeOnboarding(formData: FormData): Promise<void> {
  const name = (formData.get("name") ?? "").toString().trim();
  let handle = (formData.get("handle") ?? "").toString().toLowerCase().trim();
  const college = (formData.get("college") ?? "").toString().trim();
  const branch = (formData.get("branch") ?? "").toString().trim();
  const year_of_study = (formData.get("year_of_study") ?? "").toString().trim();
  const city = (formData.get("city") ?? "").toString().trim();
  const birthdate = (formData.get("birthdate") ?? "").toString().trim();
  const interests = formData.getAll("interests").map((x) => x.toString()).slice(0, 5);

  if (!name) redirect("/onboarding?error=name");
  if (!handle.match(/^[a-z0-9_]{3,32}$/)) redirect("/onboarding?error=handle");
  if (interests.length < 3) redirect("/onboarding?error=" + encodeURIComponent("Please select at least 3 interests."));

  const res = await upsertOnboardingProfile({
    handle,
    name,
    college,
    branch,
    year_of_study,
    city,
    birthdate: birthdate || null,
    interests,
  });

  if (!res.ok) {
    redirect(`/onboarding?error=${encodeURIComponent(res.error ?? "save")}`);
  }
  redirect("/home");
}
