import { SettingsView, type SettingsInitial } from "@/components/composite/SettingsView";
import { getMyProfile, computeChangeWindow } from "@/lib/db/profiles";
import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");

  const sb = await getSupabaseServer();
  const email = sb ? (await sb.auth.getUser()).data.user?.email ?? "" : "";

  const rawPrivacy = profile.privacy as Record<string, boolean> | null;
  const privacy: SettingsInitial["privacy"] = rawPrivacy
    ? {
        public_profile: rawPrivacy.public_profile ?? true,
        searchable: rawPrivacy.searchable ?? true,
        read_receipts: rawPrivacy.read_receipts ?? false,
      }
    : null;

  // 7-day change windows for name + handle, computed from the stored stamps.
  // These are advisory hints; the server (updateProfile) is the real gate.
  const profileRow = profile as typeof profile & {
    last_name_change_at?: string | null;
    last_handle_change_at?: string | null;
    digest_opt_out?: boolean | null;
  };
  const nameChange = computeChangeWindow(profileRow.last_name_change_at ?? null);
  const handleChange = computeChangeWindow(profileRow.last_handle_change_at ?? null);

  // Weekly-digest subscription state. `digest_opt_out` defaults to false in the
  // DB (0051), so a member with no explicit value is receiving the digest.
  const digestOptOut = profileRow.digest_opt_out ?? false;

  const initial: SettingsInitial = {
    name: profile.name ?? "",
    handle: profile.handle ?? "",
    email,
    college: profile.college ?? "",
    branch: profile.branch ?? "",
    year_of_study: profile.year_of_study ?? "",
    dm_permission: profile.dm_permission ?? "everyone",
    privacy,
    notificationPrefs: profile.notification_prefs ?? null,
    digestOptOut,
    nameChange,
    handleChange,
  };

  return <SettingsView initial={initial} />;
}
