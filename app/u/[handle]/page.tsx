import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { PublicTopNav } from "@/components/layout/PublicTopNav";
import { MapPin, GraduationCap, ExternalLink, BadgeCheck, MessageCircle, Heart, Pin, Globe, Github, Linkedin, Instagram, Twitter, Youtube } from "lucide-react";
import { getProfileByHandle } from "@/lib/db/profiles";
import { getProfilePosts } from "@/lib/db/posts";
import { getFollowState, getConnectionStatus } from "@/lib/db/social";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { ProfileLinks } from "@/lib/supabase/types";
import { ProfileActions } from "@/components/composite/ProfileActions";
import { getVerifiedProjectsForUser } from "@/lib/db/projects";

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
    case "website":
      return `https://${value}`;
    case "github":
      return `https://github.com/${value.replace(/^@/, "")}`;
    case "linkedin":
      return `https://linkedin.com/in/${value.replace(/^@/, "")}`;
    case "instagram":
      return `https://instagram.com/${value.replace(/^@/, "")}`;
    case "twitter":
      return `https://twitter.com/${value.replace(/^@/, "")}`;
    case "youtube":
      return `https://youtube.com/@${value.replace(/^@/, "")}`;
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

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile) {
    // Real "not found" state: handle is unclaimed or user not signed up.
    return (
      <main className="min-h-dvh bg-cream">
        <PublicTopNav />
        <div className="container-edit pt-40">
          <p className="text-caption">@{handle}</p>
          <h1 className="mt-4 font-serif text-5xl text-ink">
            Profile <span className="italic text-saffron">not found.</span>
          </h1>
          <p className="mt-4 text-body text-ash">
            This handle is either available or the user has not signed up yet.
          </p>
          <Link href="/signup" className="mt-8 inline-block">
            <Button size="lg">Claim this handle</Button>
          </Link>
        </div>
      </main>
    );
  }

  // Enforce the privacy.public_profile setting: a private profile is only fully
  // visible to its owner. Everyone else sees a minimal "private" card.
  const sb = await getSupabaseServer();
  const viewerId = sb ? (await sb.auth.getUser()).data.user?.id ?? null : null;
  const isOwner = viewerId === profile.id;
  const isPublic =
    (profile.privacy as { public_profile?: boolean } | null)?.public_profile !== false;

  if (!isPublic && !isOwner) {
    return (
      <main className="min-h-dvh bg-cream">
        <PublicTopNav />
        <div className="container-edit max-w-xl pt-40 text-center">
          <Avatar name={profile.name} src={profile.avatar_url ?? undefined} size="2xl" className="mx-auto ring-4 ring-cream" />
          <h1 className="mt-6 font-serif text-3xl text-ink">{profile.name}</h1>
          <p className="mt-1 text-sm text-ash">@{profile.handle}</p>
          <p className="mt-6 text-body text-ash">
            This profile is <span className="text-ink">private</span>. Connect with{" "}
            {profile.name.split(" ")[0]} to see their work.
          </p>
          <div className="mt-8 flex justify-center">
            <ProfileActions
              handle={profile.handle}
              targetUserId={profile.id}
              initialState={{ isFollowing: false }}
              initialConnection={"none"}
            />
          </div>
        </div>
      </main>
    );
  }

  const [posts, followState, connectionStatus, verifiedProjects] = await Promise.all([
    getProfilePosts(profile.id, 12),
    getFollowState(profile.id),
    getConnectionStatus(profile.id),
    getVerifiedProjectsForUser(profile.id),
  ]);

  const socialLinks = buildSocialLinks(profile.links);

  return (
    <main className="min-h-dvh bg-cream">
      <PublicTopNav />
      <div className="container-edit pt-32 pb-20">
        <Reveal>
          <div className="relative -mx-6 h-40 overflow-hidden bg-[linear-gradient(135deg,#0B1220_0%,#0A0F1C_100%)] sm:h-48 md:-mx-10 md:h-56 xl:-mx-16">
            {/* Cobalt accent glow - top right, mirrors the owner profile cover */}
            <div
              className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20"
              style={{
                background:
                  "radial-gradient(ellipse at 80% 20%, #2C5BFF 0%, transparent 60%)",
              }}
            />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="-mt-14 flex flex-col gap-6 sm:-mt-16 md:-mt-20 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-col items-start gap-4">
              <Avatar name={profile.name} src={profile.avatar_url ?? undefined} size="2xl" className="ring-4 ring-cream" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="font-serif text-3xl text-ink wrap-break-word sm:text-4xl md:text-5xl">{profile.name}</h1>
                  {profile.verified ? <Tag variant="saffron">Verified</Tag> : null}
                </div>
                <p className="mt-1 text-sm text-ash">@{profile.handle}</p>
                {profile.bio ? <p className="mt-3 max-w-xl text-body text-ink">{profile.bio}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ash">
                  {profile.college ? (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="size-4" /> {profile.college}
                      {profile.branch ? ` . ${profile.branch}` : ""}
                      {profile.year_of_study ? ` '${profile.year_of_study}` : ""}
                    </span>
                  ) : null}
                  {profile.city ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" /> {profile.city}
                    </span>
                  ) : null}
                </div>
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
            <ProfileActions
              handle={profile.handle}
              targetUserId={profile.id}
              initialState={{ isFollowing: followState.isFollowing }}
              initialConnection={followState.isConnected ? "connected" : connectionStatus}
            />
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-12">
            <div className="mb-5 flex items-center gap-2 border-b border-bone pb-3">
              <h2 className="text-caption text-ash">Recent posts</h2>
              {posts.length > 0 ? (
                <span className="rounded-full bg-bone px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-ash">
                  {posts.length}
                </span>
              ) : null}
            </div>
            {posts.length === 0 ? (
              <div className="rounded-xl border border-bone bg-paper p-10 text-center">
                <p className="text-ash">No posts yet.</p>
              </div>
            ) : (
              <Stagger className="flex flex-col gap-6" step={0.06}>
              {posts.map((p) => {
                const image = p.image_urls?.[0];
                return (
                  <Link
                    key={p.id}
                    href={`/p/${p.short_id}`}
                    className="group block overflow-hidden rounded-xl border border-bone bg-paper p-5 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm md:p-6"
                  >
                    {p.is_pinned ? (
                      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ash">
                        <Pin className="size-3.5 text-saffron" /> Pinned
                      </div>
                    ) : null}

                    {p.body ? (
                      <p className="whitespace-pre-line text-body text-ink line-clamp-6">{p.body}</p>
                    ) : null}

                    {image ? (
                      <div className="mt-4 overflow-hidden rounded-lg border border-bone bg-cream">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image}
                          alt=""
                          className="max-h-112 w-full object-cover"
                        />
                      </div>
                    ) : null}

                    {p.hashtags && p.hashtags.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {p.hashtags.slice(0, 6).map((tag) => (
                          <Tag key={tag} variant="outline" className="text-xs">
                            #{tag.replace(/^#/, "")}
                          </Tag>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-5 flex items-center gap-5 border-t border-bone pt-4 text-sm text-ash">
                      <span className="flex items-center gap-1.5">
                        <Heart className="size-4" /> {p.like_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle className="size-4" /> {p.comment_count ?? 0}
                      </span>
                      <span className="ml-auto flex items-center gap-1 text-xs text-ash opacity-70 transition-opacity group-hover:opacity-100 sm:opacity-0">
                        View post <ExternalLink className="size-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
              </Stagger>
            )}
          </div>
        </Reveal>

        {verifiedProjects.length > 0 && (
          <Reveal delay={0.3}>
            <div className="mt-16">
              <div className="flex items-center gap-2 border-b border-bone pb-3">
                <BadgeCheck className="size-4 text-saffron" />
                <h2 className="text-caption text-ash">Verified contributions</h2>
                <span className="rounded-full bg-bone px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-ash">
                  {verifiedProjects.length}
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {(verifiedProjects as unknown as Array<{
                  role: string;
                  project: {
                    id: string;
                    short_id: string;
                    title: string;
                    deliverable_url: string | null;
                    delivered_at: string | null;
                    author: { handle: string; name: string };
                  };
                }>).map((m) => (
                  <div
                    key={m.project.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-bone bg-paper px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Tag variant="moss" className="text-xs">Verified contributor</Tag>
                        {m.role === "owner" && (
                          <Tag variant="saffron" className="text-xs">Author</Tag>
                        )}
                      </div>
                      <Link
                        href={`/c/${m.project.short_id}`}
                        className="mt-2 block text-sm font-medium text-ink hover:underline"
                      >
                        {m.project.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-ash">
                        by @{m.project.author.handle}
                        {m.project.delivered_at
                          ? ` . delivered ${new Date(m.project.delivered_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`
                          : ""}
                      </p>
                    </div>
                    {m.project.deliverable_url && (
                      <a
                        href={m.project.deliverable_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1 text-xs text-ash hover:text-ink"
                      >
                        View <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </main>
  );
}
