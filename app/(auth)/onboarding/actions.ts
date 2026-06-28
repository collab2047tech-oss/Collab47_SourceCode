"use server";

import { upsertOnboardingProfile } from "@/lib/db/profiles";
import type { AccountType } from "@/lib/supabase/types";
import { redirect } from "next/navigation";

const ACCOUNT_TYPES: AccountType[] = [
  "student",
  "researcher",
  "faculty",
  "institution",
  "industry",
];

// Used as a <form action>. Returns void; on validation failure it redirects
// back to onboarding with an ?error= the page can surface.
export async function completeOnboarding(formData: FormData): Promise<void> {
  const name = (formData.get("name") ?? "").toString().trim();
  let handle = (formData.get("handle") ?? "").toString().toLowerCase().trim();
  const rawType = (formData.get("account_type") ?? "").toString().trim();
  const account_type = ACCOUNT_TYPES.includes(rawType as AccountType)
    ? (rawType as AccountType)
    : null;

  // Branched fields. Only the ones relevant to the chosen type are sent by the
  // client, but we read all of them defensively.
  const college = (formData.get("college") ?? "").toString().trim();
  const organization = (formData.get("organization") ?? "").toString().trim();
  const branch = (formData.get("branch") ?? "").toString().trim();
  const role = (formData.get("role") ?? "").toString().trim();
  const year_of_study = (formData.get("year_of_study") ?? "").toString().trim();
  const city = (formData.get("city") ?? "").toString().trim();
  const birthdate = (formData.get("birthdate") ?? "").toString().trim();
  const interests = formData.getAll("interests").map((x) => x.toString()).slice(0, 8);

  if (!account_type) redirect("/onboarding?error=" + encodeURIComponent("Please choose how you are joining."));
  if (!name) redirect("/onboarding?error=name");
  if (!handle.match(/^[a-z0-9_]{3,32}$/)) redirect("/onboarding?error=handle");
  if (interests.length < 3) redirect("/onboarding?error=" + encodeURIComponent("Please select at least 3 interests."));

  // Map the branched fields to real columns per account type. No fabricated
  // values: anything not collected for a type is left undefined (stored null).
  let collegeCol: string | undefined;
  let orgCol: string | undefined;
  let branchCol: string | undefined;
  let yearCol: string | undefined;
  let cityCol: string | undefined;
  let birthCol: string | null | undefined;

  switch (account_type) {
    case "student":
      collegeCol = college;
      branchCol = branch;
      yearCol = year_of_study;
      cityCol = city;
      birthCol = birthdate || null;
      break;
    case "researcher":
      collegeCol = college; // institution / lab
      branchCol = branch; // field / area
      break;
    case "faculty":
      collegeCol = college; // institution
      branchCol = branch; // department
      break;
    case "institution":
      orgCol = organization; // organization name
      cityCol = city; // location / city
      break;
    case "industry":
      orgCol = organization; // company / org name
      // Combine role and industry sector so neither is lost (no role column).
      branchCol = role && branch ? `${role} - ${branch}` : role || branch || undefined;
      break;
  }

  const res = await upsertOnboardingProfile({
    handle,
    name,
    account_type,
    college: collegeCol,
    organization: orgCol,
    branch: branchCol,
    year_of_study: yearCol,
    city: cityCol,
    birthdate: birthCol,
    interests,
  });

  if (!res.ok) {
    redirect(`/onboarding?error=${encodeURIComponent(res.error ?? "save")}`);
  }
  redirect("/home");
}
