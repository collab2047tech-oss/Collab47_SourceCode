import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { ProfileTabs } from "@/components/composite/ProfileTabs";
import { normalizeVerified } from "@/lib/ui/verified";
import { ProfileStrength } from "./ProfileStrength";
import { computeStrength } from "./strength";
import { getMyProfile } from "@/lib/db/profiles";
import { getProfilePosts } from "@/lib/db/posts";
import { getMyConnections } from "@/lib/db/social";
import { getVerifiedProjectsForUser } from "@/lib/db/projects";
import { getResume } from "@/lib/db/resume";
import { ProfileResumeEditor } from "@/components/composite/ProfileResumeEditor";
import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShareButton } from "@/components/composite/ShareButton";
import {
  EditableProfileProvider,
  type ProfileValues,
} from "@/components/composite/profile-edit/EditableProfileProvider";
import { EditableBanner } from "@/components/composite/profile-edit/EditableBanner";
import { EditableAvatar } from "@/components/composite/profile-edit/EditableAvatar";
import { IntroCard } from "@/components/composite/profile-edit/IntroCard";
import type { ProfileLinks } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const SOCIAL_LABELS: Record<string, string> = {
  website: "Website",
  github: "GitHub",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "Twitter / X",
  youtube: "YouTube",
};

function buildSocialHref(platform: string, raw: string): string {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  switch (platform) {
    case "website": return `https://${value}`;
    case "github": return `https://github.com/${value.replace(/^@/, "")}`;
    case "linkedin": return `https://linkedin.com/in/${value.replace(/^@/, "")}`;
    case "instagram": return `https://instagram.com/${value.replace(/^@/, "")}`;
    case "twitter": return `https://twitter.com/${value.replace(/^@/, "")}`;
    case "youtube": return `https://youtube.com/@${value.replace(/^@/, "")}`;
    default: return value;
  }
}

function buildSocialLinks(links: ProfileLinks | null | undefined) {
  if (!links) return [];
  const order = ["website", "github", "linkedin", "instagram", "twitter", "youtube"] as const;
  return order
    .filter((p) => typeof links[p] === "string" && (links[p] as string).trim() !== "")
    .map((platform) => ({
      platform,
      label: SOCIAL_LABELS[platform],
      href: buildSocialHref(platform, links[platform] as string),
    }));
}

export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");

  const sb = await getSupabaseServer();

  // Fold every read into one parallel batch.
  const [posts, connections, verifiedProjects, resume, projectCountRes, projRowsRes] = await Promise.all([
    getProfilePosts(profile.id, 24),
    getMyConnections("all"),
    getVerifiedProjectsForUser(profile.id),
    getResume(profile.id),
    sb
      ? sb.from("project_members").select("project_id", { count: "exact", head: true }).eq("user_id", profile.id)
      : Promise.resolve({ count: 0 } as { count: number }),
    sb
      ? sb.from("projects").select("id, short_id, title, brief, status, slot_count").eq("author_id", profile.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] } as { data: unknown[] }),
  ]);

  const projectCount = (projectCountRes as { count: number | null }).count ?? 0;
  const myProjects = ((projRowsRes as { data: unknown[] }).data ?? []) as import("@/components/composite/ProfileTabs").ProfileProject[];

  const stats = {
    connections: connections.length,
    posts: posts.length,
    projects: projectCount,
  };

  // Owner-only profile strength (never rendered on the visitor page).
  const strength = computeStrength(profile, {
    posts: posts.length,
    projects: projectCount,
    connections: connections.length,
  });

  const p = profile;
  // Social links are HIDDEN sitewide for now (collection is disabled in
  // ProfileEditForm + profile/edit/actions.ts). Forcing this to empty hides every
  // link surface at once without leaving dangling refs. Existing rows in
  // profiles.links are untouched, so restoring is a one-line revert.
  const socialLinks: ReturnType<typeof buildSocialLinks> = [];

  // Complete snapshot handed to the inline-edit provider. Every field is present
  // (never undefined) so each save is a full snapshot and untouched fields keep
  // their stored values rather than being cleared by updateProfileAction.
  const initial: ProfileValues = {
    name: p.name ?? "",
    title: p.title ?? "",
    bio: p.bio ?? "",
    college: p.college ?? "",
    branch: p.branch ?? "",
    year_of_study: p.year_of_study ?? "",
    city: p.city ?? "",
    avatar_url: p.avatar_url ?? "",
    cover_url: p.cover_url ?? "",
    banner_preset: p.banner_preset ?? "",
    cover_focal_x: p.cover_focal_x ?? 50,
    cover_focal_y: p.cover_focal_y ?? 50,
    handle: p.handle ?? "",
    verified: p.verified ?? false,
  };

  return (
    <div className="min-h-dvh bg-cream">
      {/* Everything the owner can edit in place is wrapped in one provider so a
          save always sends a COMPLETE snapshot (never wiping untouched fields). */}
      <EditableProfileProvider initial={initial}>
        {/* -------------------------------------------------------------- */}
        {/* BANNER - inline editable (presets / upload / drag reposition)  */}
        {/* -------------------------------------------------------------- */}
        <Reveal y={0}>
          <EditableBanner priority className="h-40 sm:h-52 md:h-65" />
        </Reveal>

        {/* -------------------------------------------------------------- */}
        {/* PROFILE HEADER - inline editable avatar + intro card           */}
        {/* -------------------------------------------------------------- */}
        <div className="mx-auto max-w-5xl px-4 md:px-8">
          <Reveal delay={0.05}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {/* Avatar overlaps the banner (image, not text -> always legible). */}
                <div className="-mt-14 shrink-0 self-start sm:-mt-16 md:-mt-20">
                  <EditableAvatar />
                </div>

                {/* Identity card on solid paper -> name contrast on any banner. */}
                <IntroCard />
              </div>

              {/* RIGHT: share + progressive fallback to the full editor. */}
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <ShareButton path={`/u/${p.handle}`} label="Share" />
                <Link
                  href="/profile/edit"
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-ash underline decoration-bone underline-offset-4 transition-colors hover:text-ink hover:decoration-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                >
                  Open full editor
                </Link>
              </div>
            </div>
          </Reveal>

          {/* -------------------------------------------------------------- */}
          {/* PROFILE STRENGTH - OWNER ONLY                                   */}
          {/* -------------------------------------------------------------- */}
          <Reveal delay={0.1}>
            <ProfileStrength isOwner score={strength.score} items={strength.items} todo={strength.todo} />
          </Reveal>

          {/* -------------------------------------------------------------- */}
          {/* STATS STRIP (no score here - that is owner-only above)          */}
          {/* -------------------------------------------------------------- */}
          <Reveal delay={0.12}>
            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-bone bg-bone">
              {[
                { label: "Connections", value: stats.connections },
                { label: "Posts", value: stats.posts },
                { label: "Projects", value: stats.projects },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center justify-center bg-paper px-4 py-5 text-center transition-colors hover:bg-cream"
                >
                  <div className="font-serif text-3xl font-normal text-ink" style={{ letterSpacing: "-0.02em" }}>
                    <CountUp to={s.value} />
                  </div>
                  <p className="mt-1 text-caption tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* -------------------------------------------------------------- */}
          {/* BACKGROUND - inline Experience / Education / Skills editor      */}
          {/* -------------------------------------------------------------- */}
          <Reveal delay={0.14}>
            <div className="mt-10">
              <h2 className="mb-5 font-serif text-2xl text-ink" style={{ letterSpacing: "-0.01em" }}>
                Background
              </h2>
              <ProfileResumeEditor resume={resume} />
            </div>
          </Reveal>

          {/* -------------------------------------------------------------- */}
          {/* TABS + CONTENT                                                 */}
          {/* -------------------------------------------------------------- */}
          <ProfileTabs
            posts={posts}
            projects={myProjects}
            verifiedProjects={normalizeVerified(verifiedProjects as unknown[])}
            bio={p.bio}
            college={p.college}
            branch={p.branch}
            city={p.city}
            year_of_study={p.year_of_study}
            accountType={p.account_type}
            interests={p.interests}
            socialLinks={socialLinks}
            currentUserId={p.id}
            isOwner
          />
        </div>
      </EditableProfileProvider>

      {/* bottom breathing room */}
      <div className="h-16 md:h-24" />
    </div>
  );
}
