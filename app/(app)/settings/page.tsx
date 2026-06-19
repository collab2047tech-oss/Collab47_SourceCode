import { SettingsView, type SettingsInitial } from "@/components/composite/SettingsView";
import { getMyProfile } from "@/lib/db/profiles";
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
  };

  return <SettingsView initial={initial} />;
}
