import { getMyProfile } from "@/lib/db/profiles";
import { ProfileEditForm } from "@/components/composite/ProfileEditForm";

const MOCK_PROFILE = {
  name: "Akshpreet Singh",
  handle: "akshpreet",
  bio: "CEO and Co-founder, Collab47. Building India's work-first network for students.",
  college: "Punjabi University",
  branch: "CSE",
  year_of_study: "4",
  city: "Amritsar",
  avatar_url: null as string | null,
  cover_url: null as string | null,
};

export default async function ProfileEditPage() {
  const profile = await getMyProfile();
  const p = profile ?? MOCK_PROFILE;

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
