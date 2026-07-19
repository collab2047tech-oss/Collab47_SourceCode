"use server";

import { upsertOnboardingProfile } from "@/lib/db/profiles";
import { isReserved } from "@/lib/data/reserved-handles";
import { moderateContent } from "@/lib/moderation/moderate";
import type { AccountType } from "@/lib/supabase/types";
import { redirect } from "next/navigation";

const ACCOUNT_TYPES: AccountType[] = [
  "student",
  "researcher",
  "faculty",
  "institution",
  "industry",
  "startup",
];

/** Result surfaced back to the onboarding client. */
export type OnboardingState = { ok: false; error: string } | null;

// Used with useActionState. CRITICAL: validation failures RETURN an error, they
// must never redirect. A redirect here makes React remount the onboarding client,
// which resets every useState and dumps the user back on step 1 with all of their
// answers wiped (the "username taken" bug). Only SUCCESS redirects.
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const title = (formData.get("title") ?? "").toString().trim();
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

  if (!account_type) return { ok: false, error: "Please choose how you are joining." };
  if (!name) return { ok: false, error: "Enter your full name." };
  if (!handle.match(/^[a-z0-9_]{3,32}$/)) return { ok: false, error: "Username must be 3 to 32 characters: letters, numbers, underscore." };
  if (isReserved(handle)) return { ok: false, error: "That username is reserved. Pick another." };
  if (interests.length < 3) return { ok: false, error: "Please pick at least 3 interests." };

  // Moderate the user-entered free-text (name + college) in a single pass
  // before persisting - profiles are world-readable. URLs/dates/enums are not
  // moderated. On a block, redirect back with the reason like other failures.
  const moderationText = [name, college, ...interests]
    .filter((v) => v.length > 0)
    .join(" ");
  if (moderationText) {
    const moderationResult = await moderateContent(moderationText);
    if (!moderationResult.ok) {
      return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
    }
  }

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
      cityCol = city;
      break;
    case "faculty":
      collegeCol = college; // institution
      branchCol = branch; // department
      cityCol = city;
      break;
    case "institution":
      orgCol = organization; // organization name
      cityCol = city; // location / city
      break;
    case "industry":
      orgCol = organization; // company / org name
      // Combine role and industry sector so neither is lost (no role column).
      branchCol = role && branch ? `${role} - ${branch}` : role || branch || undefined;
      cityCol = city;
      break;
    case "startup":
      orgCol = organization; // startup name
      // Same shape as industry: combine role at the startup and its sector.
      branchCol = role && branch ? `${role} - ${branch}` : role || branch || undefined;
      cityCol = city;
      break;
  }

  const res = await upsertOnboardingProfile({
    handle,
    name,
    title,
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
    return { ok: false, error: res.error ?? "Could not save your profile. Try again." };
  }
  redirect("/home");
}
