import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { CountUp } from "@/components/motion/CountUp";
import { ProfileTabs } from "@/components/composite/ProfileTabs";
import { normalizeVerified } from "@/lib/ui/verified";
import { ProfileBanner } from "@/components/composite/ProfileBanner";
import { ProfileStrength } from "./ProfileStrength";
import { computeStrength } from "./strength";
import { getMyProfile } from "@/lib/db/profiles";
import { getProfilePosts } from "@/lib/db/posts";
import { getMyConnections } from "@/lib/db/social";
import { getVerifiedProjectsForUser } from "@/lib/db/projects";
import { getResume } from "@/lib/db/resume";
import { ProfileResume } from "@/components/composite/ProfileResume";
import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MapPin, GraduationCap, Pencil, CheckCircle2 } from "lucide-react";
import { ShareButton } from "@/components/composite/ShareButton";
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

  return (
    <div className="min-h-dvh bg-cream">
      {/* ------------------------------------------------------------------ */}
      {/* BANNER - shared component, identical to the visitor view            */}
      {/* ------------------------------------------------------------------ */}
      <Reveal y={0}>
        <ProfileBanner
          coverUrl={p.cover_url}
          bannerPreset={p.banner_preset}
          focalX={p.cover_focal_x}
          focalY={p.cover_focal_y}
          priority
          className="h-40 sm:h-52 md:h-65"
        />
      </Reveal>

      {/* ------------------------------------------------------------------ */}
      {/* PROFILE HEADER - avatar overlaps the banner, identity sits on paper */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <Reveal delay={0.05}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {/* Avatar overlaps the banner (image, not text -> always legible).
                  Clean white ring (no purple gradient) - crisp on any banner. */}
              <div className="-mt-14 shrink-0 self-start sm:-mt-16 md:-mt-20">
                <Avatar name={p.name} src={p.avatar_url ?? undefined} size="2xl" className="ring-4 ring-paper shadow-[0_0_0_1px_#E7E0D6]" />
              </div>

              {/* Identity CARD on solid paper -> name contrast guaranteed on any banner. */}
              <div className="rounded-2xl border border-bone bg-paper px-5 py-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="font-serif text-3xl leading-tight tracking-tight text-ink wrap-break-word sm:text-4xl md:text-5xl"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {p.name}
                  </h1>
                  {p.verified ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: "rgba(44,91,255,0.10)", color: "#B95402" }}
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                      Verified
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-sm text-ash">@{p.handle}</p>

                {(p.college || p.branch || p.city) ? (
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ash">
                    {p.college ? (
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="size-3.5 shrink-0" strokeWidth={1.75} />
                        {p.college}
                        {p.branch ? <span className="text-ink">&nbsp;&middot; {p.branch}</span> : null}
                        {p.year_of_study ? <span className="text-ink">&nbsp;&middot; &apos;{p.year_of_study}</span> : null}
                      </span>
                    ) : null}
                    {p.city ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                        {p.city}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {p.bio ? (
                  <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink">{p.bio}</p>
                ) : null}
              </div>
            </div>

            {/* RIGHT: action buttons */}
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link href="/profile/edit" className="flex-1 sm:flex-none">
                <Button variant="secondary" size="md" className="w-full gap-2 active:scale-95 sm:w-auto">
                  <Pencil className="size-4" strokeWidth={1.75} />
                  Edit profile
                </Button>
              </Link>
              <ShareButton path={`/u/${p.handle}`} label="Share" />
            </div>
          </div>
        </Reveal>

        {/* ---------------------------------------------------------------- */}
        {/* PROFILE STRENGTH - OWNER ONLY                                     */}
        {/* ---------------------------------------------------------------- */}
        <Reveal delay={0.1}>
          <ProfileStrength isOwner score={strength.score} items={strength.items} todo={strength.todo} />
        </Reveal>

        {/* ---------------------------------------------------------------- */}
        {/* STATS STRIP (no score here - that is owner-only above)            */}
        {/* ---------------------------------------------------------------- */}
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

        {/* ---------------------------------------------------------------- */}
        {/* BACKGROUND - Experience / Education / Skills (owner editor)       */}
        {/* ---------------------------------------------------------------- */}
        <Reveal delay={0.14}>
          <div className="mt-10">
            <h2 className="mb-5 font-serif text-2xl text-ink" style={{ letterSpacing: "-0.01em" }}>
              Background
            </h2>
            <ProfileResume resume={resume} isOwner />
          </div>
        </Reveal>

        {/* ---------------------------------------------------------------- */}
        {/* TABS + CONTENT                                                   */}
        {/* ---------------------------------------------------------------- */}
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

      {/* bottom breathing room */}
      <div className="h-16 md:h-24" />
    </div>
  );
}
