import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/primitives/Avatar";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { PublicTopNav } from "@/components/layout/PublicTopNav";
import { MapPin, GraduationCap, CheckCircle2, Lock, Globe, Github, Linkedin, Instagram, Twitter, Youtube } from "lucide-react";
import { getProfileByHandle, canViewProfileContent, getPublicProfileCounts } from "@/lib/db/profiles";
import { getProfilePosts } from "@/lib/db/posts";
import { getFollowState, getConnectionStatus } from "@/lib/db/social";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { ProfileLinks } from "@/lib/supabase/types";
import { ProfileActions } from "@/components/composite/ProfileActions";
import { ProfileBanner } from "@/components/composite/ProfileBanner";
import { ProfileTabs } from "@/components/composite/ProfileTabs";
import { ProfileResume } from "@/components/composite/ProfileResume";
import { ProfileViewTracker } from "@/components/composite/ProfileViewTracker";
import { normalizeVerified } from "@/lib/ui/verified";
import { getVerifiedProjectsForUser } from "@/lib/db/projects";
import { getResume } from "@/lib/db/resume";
import type { Resume } from "@/lib/db/resume";

type SocialPlatform = "website" | "github" | "linkedin" | "instagram" | "twitter" | "youtube";

const SOCIAL_ICONS: Record<SocialPlatform, typeof Globe> = {
  website: Globe,
  github: Github,
  linkedin: Linkedin,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  website: "Website",
  github: "GitHub",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "Twitter / X",
  youtube: "YouTube",
};

const SOCIAL_ORDER: SocialPlatform[] = ["website", "github", "linkedin", "instagram", "twitter", "youtube"];

function buildSocialHref(platform: SocialPlatform, raw: string): string {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  switch (platform) {
    case "website": return `https://${value}`;
    case "github": return `https://github.com/${value.replace(/^@/, "")}`;
    case "linkedin": return `https://linkedin.com/in/${value.replace(/^@/, "")}`;
    case "instagram": return `https://instagram.com/${value.replace(/^@/, "")}`;
    case "twitter": return `https://twitter.com/${value.replace(/^@/, "")}`;
    case "youtube": return `https://youtube.com/@${value.replace(/^@/, "")}`;
  }
}

function buildSocialLinks(links: ProfileLinks | null | undefined) {
  if (!links) return [];
  return SOCIAL_ORDER.filter((p) => {
    const v = links[p];
    return typeof v === "string" && v.trim() !== "";
  }).map((platform) => ({
    platform,
    label: SOCIAL_LABELS[platform],
    Icon: SOCIAL_ICONS[platform],
    href: buildSocialHref(platform, links[platform] as string),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile) {
    return { title: "Profile not found", robots: { index: false, follow: false } };
  }

  const title = `${profile.name} (@${profile.handle})`;
  const description = profile.bio
    ? profile.bio.slice(0, 160)
    : `${profile.name} (@${profile.handle})${profile.college ? ` at ${profile.college}` : ""} on Collab47.`;
  const canonical = `/u/${profile.handle}`;

  return {
    title,
    description,
    alternates: { canonical },
    // OG + Twitter images come from the dynamic app/u/[handle]/opengraph-image.tsx
    // (branded card) via the file convention, so they are intentionally omitted here.
    openGraph: {
      type: "profile",
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile) {
    notFound();
  }

  // Privacy gate. A PRIVATE profile shows its basics (banner, identity, counts)
  // to everyone, but its CONTENT (posts + project details) only to the owner or
  // an accepted connection. Public profiles are fully visible. canViewProfileContent
  // is the server-side gate; migration 0030 RLS is the deeper API-level defense.
  const sb = await getSupabaseServer();
  const viewerId = sb ? (await sb.auth.getUser()).data.user?.id ?? null : null;
  const isOwner = viewerId === profile.id;
  const isPrivate =
    (profile.privacy as { public_profile?: boolean } | null)?.public_profile === false;
  const canViewContent = await canViewProfileContent(viewerId, profile);

  // Social links are HIDDEN sitewide for now (collection is disabled in
  // ProfileEditForm + profile/edit/actions.ts). Forcing this to empty hides every
  // link surface at once without leaving dangling refs. Existing rows in
  // profiles.links are untouched, so restoring is a one-line revert.
  const socialLinks: ReturnType<typeof buildSocialLinks> = [];

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: profile.name,
      alternateName: `@${profile.handle}`,
      description: profile.bio ?? undefined,
      image: profile.avatar_url ?? undefined,
      affiliation: profile.college ?? undefined,
      url: `https://collab47.com/u/${profile.handle}`,
      sameAs: socialLinks.map((l) => l.href),
    },
  };

  // Always fetch the lightweight identity data (follow/connection state for the
  // action button). Content queries (posts, verified projects, authored projects)
  // run ONLY when the viewer is allowed to see content - this avoids leaking and
  // makes the private shell render faster than a full profile.
  const [followState, connectionStatus, counts] = await Promise.all([
    getFollowState(profile.id),
    getConnectionStatus(profile.id),
    getPublicProfileCounts(profile.id),
  ]);

  type ProfileProjectType = import("@/components/composite/ProfileTabs").ProfileProject;

  let posts: Awaited<ReturnType<typeof getProfilePosts>> = [];
  let verifiedProjects: unknown[] = [];
  let authoredProjects: ProfileProjectType[] = [];
  let resume: Resume = { experience: [], education: [], skills: [] };

  if (canViewContent) {
    const [postsRes, verifiedRes, authoredProjRes, resumeRes] = await Promise.all([
      getProfilePosts(profile.id, 24),
      getVerifiedProjectsForUser(profile.id),
      sb
        ? sb.from("projects").select("id, short_id, title, brief, status, slot_count").eq("author_id", profile.id).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] } as { data: unknown[] }),
      getResume(profile.id),
    ]);
    posts = postsRes;
    verifiedProjects = verifiedRes as unknown[];
    authoredProjects = ((authoredProjRes as { data: unknown[] }).data ?? []) as ProfileProjectType[];
    resume = resumeRes;
  }

  const firstName = profile.name.split(" ")[0] || profile.name;
  const stats = [
    { label: "Connections", value: counts.connections },
    { label: "Posts", value: counts.posts },
    { label: "Projects", value: counts.projects },
  ];

  return (
    <main className="min-h-dvh bg-cream">
      <PublicTopNav />

      {!isPrivate ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }} />
      ) : null}

      {/* Record this profile view once (dedup + self-skip handled server-side). */}
      <ProfileViewTracker targetId={profile.id} />

      {/* BANNER - shared component, identical to the owner view (cover path fixed) */}
      <div className="pt-16">
        <Reveal y={0}>
          <ProfileBanner
            coverUrl={profile.cover_url}
            bannerPreset={profile.banner_preset}
            focalX={profile.cover_focal_x}
            focalY={profile.cover_focal_y}
            priority
            className="h-40 sm:h-52 md:h-65"
          />
        </Reveal>
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <Reveal delay={0.05}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {/* Avatar overlaps banner; clean white ring (no purple gradient). */}
              <div className="-mt-14 shrink-0 self-start sm:-mt-16 md:-mt-20">
                <Avatar name={profile.name} src={profile.avatar_url ?? undefined} size="2xl" className="ring-4 ring-paper shadow-[0_0_0_1px_#DDE3EE]" />
              </div>

              <div className="rounded-2xl border border-bone bg-paper px-5 py-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-3xl leading-tight tracking-tight text-ink wrap-break-word sm:text-4xl md:text-5xl" style={{ letterSpacing: "-0.02em" }}>
                    {profile.name}
                  </h1>
                  {profile.verified ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: "rgba(44,91,255,0.10)", color: "#2C5BFF" }}
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                      Verified
                    </span>
                  ) : null}
                  {isPrivate ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-bone bg-cream px-2.5 py-0.5 text-xs font-semibold text-ink">
                      <Lock className="size-3.5" strokeWidth={2.5} />
                      Private
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-sm text-ash">@{profile.handle}</p>

                {(profile.college || profile.city) ? (
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ash">
                    {profile.college ? (
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="size-3.5 shrink-0" strokeWidth={1.75} />
                        {profile.college}
                        {profile.branch ? <span className="text-ink">&nbsp;&middot; {profile.branch}</span> : null}
                        {profile.year_of_study ? <span className="text-ink">&nbsp;&middot; &apos;{profile.year_of_study}</span> : null}
                      </span>
                    ) : null}
                    {profile.city ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                        {profile.city}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {profile.bio ? <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink">{profile.bio}</p> : null}

                {socialLinks.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {socialLinks.map(({ platform, label, Icon, href }) => (
                      <a
                        key={platform}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        title={label}
                        className="flex size-10 items-center justify-center rounded-full border border-bone bg-paper text-ash transition-all hover:-translate-y-0.5 hover:border-saffron hover:text-saffron-dk active:scale-95"
                      >
                        <Icon className="size-4" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0">
              <ProfileActions
                handle={profile.handle}
                targetUserId={profile.id}
                initialState={{ isFollowing: followState.isFollowing }}
                initialConnection={followState.isConnected ? "connected" : connectionStatus}
              />
            </div>
          </div>
        </Reveal>

        {/* STATS STRIP (no profile score - that is owner-only) */}
        <Reveal delay={0.12}>
          <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-bone bg-bone">
            {stats.map((s) => (
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

        {canViewContent ? (
          <>
            {/* BACKGROUND - Experience / Education / Skills (read-only).
                Renders nothing when the viewer-visible resume is empty. */}
            {(resume.experience.length > 0 || resume.education.length > 0 || resume.skills.length > 0) ? (
              <Reveal delay={0.14}>
                <div className="mt-10">
                  <h2 className="mb-5 font-serif text-2xl text-ink" style={{ letterSpacing: "-0.01em" }}>
                    Background
                  </h2>
                  <ProfileResume resume={resume} isOwner={false} />
                </div>
              </Reveal>
            ) : null}

            {/* SYMMETRICAL TABS - same component as the owner, owner controls hidden */}
            <ProfileTabs
            posts={posts}
            projects={authoredProjects}
            verifiedProjects={normalizeVerified(verifiedProjects as unknown[])}
            bio={profile.bio}
            college={profile.college}
            branch={profile.branch}
            city={profile.city}
            year_of_study={profile.year_of_study}
            accountType={profile.account_type}
            interests={profile.interests}
            socialLinks={socialLinks.map((l) => ({ platform: l.platform, label: l.label, href: l.href }))}
            currentUserId={viewerId ?? undefined}
            isOwner={false}
          />
          </>
        ) : (
          /* PRIVATE SHELL - basics + counts are above; content is gated here.
             Visitor still sees who this is and can connect, but not the work. */
          <Reveal delay={0.16}>
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-bone bg-paper px-6 py-14 text-center">
              <div className="flex size-14 items-center justify-center rounded-full border border-bone bg-cream">
                <Lock className="size-6 text-ink" strokeWidth={2} />
              </div>
              <h2 className="mt-5 font-serif text-2xl text-ink">This account is private</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ash">
                Connect with <span className="font-semibold text-ink">{firstName}</span> to see their
                posts and projects. Their basic details and counts are shown above.
              </p>
              <div className="mt-6">
                <ProfileActions
                  handle={profile.handle}
                  targetUserId={profile.id}
                  initialState={{ isFollowing: followState.isFollowing }}
                  initialConnection={followState.isConnected ? "connected" : connectionStatus}
                />
              </div>
            </div>
          </Reveal>
        )}
      </div>

      <div className="h-16 md:h-24" />
    </main>
  );
}
