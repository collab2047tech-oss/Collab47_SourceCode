import { getMyProfile } from "@/lib/db/profiles";
import { ProfileEditForm } from "@/components/composite/ProfileEditForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const p = profile;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rule-top">
        <p className="text-caption">Profile</p>
        <h1 className="mt-4 text-display-md text-ink">Edit profile</h1>
      </div>

      <div className="mt-10">
        <ProfileEditForm
          name={p.name ?? ""}
          handle={p.handle ?? ""}
          bio={p.bio ?? ""}
          college={p.college ?? ""}
          branch={p.branch ?? ""}
          year_of_study={p.year_of_study ?? ""}
          city={p.city ?? ""}
          avatar_url={p.avatar_url ?? null}
          cover_url={p.cover_url ?? null}
        />
      </div>
    </div>
  );
}
