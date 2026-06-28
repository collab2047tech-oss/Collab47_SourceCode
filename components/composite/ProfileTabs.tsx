"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Tag } from "@/components/primitives/Tag";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { Heart, MessageCircle, Repeat2, Pin, BookOpen, Layers, Star, Info, Trash2, BadgeCheck, ExternalLink, MapPin, GraduationCap, Calendar, Briefcase, Tag as TagIcon } from "lucide-react";
import { Avatar } from "@/components/primitives/Avatar";
import type { PostWithAuthor, RepostedOriginal } from "@/lib/db/posts";
import { deletePostAction } from "@/app/(app)/home/actions";
import type { VerifiedContribution } from "@/lib/ui/verified";

export type { VerifiedContribution } from "@/lib/ui/verified";

type TabId = "posts" | "projects" | "highlights" | "about";

export interface ProfileProject {
  id: string;
  short_id: string;
  title: string;
  brief: string;
  status: string;
  slot_count: number;
}

interface ProfileTabsProps {
  posts: PostWithAuthor[];
  projects?: ProfileProject[];
  /** Verified contributions (shown on the visitor page + owner page). */
  verifiedProjects?: VerifiedContribution[];
  bio?: string | null;
  college?: string | null;
  branch?: string | null;
  city?: string | null;
  year_of_study?: string | null;
  accountType?: string | null;
  interests?: string[];
  socialLinks?: { platform: string; label: string; href: string }[];
  /** The viewing user's id. When it matches a post's author, delete is shown. */
  currentUserId?: string;
  /** Owner-only controls (delete posts). Visitors pass false. */
  isOwner?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ---------------------------------------------------------------------------
// Highlight Story Bubble
// ---------------------------------------------------------------------------

function HighlightBubble({ post }: { post: PostWithAuthor }) {
  // Use first image or derive a color shard from the post short_id
  const hasImage = (post.image_urls?.length ?? 0) > 0;
  const firstImage = hasImage ? post.image_urls![0] : null;
  const snippet = post.body?.slice(0, 2).toUpperCase() || "P";

  return (
    <Link
      href={`/p/${post.short_id}`}
      className="group flex flex-col items-center gap-2"
    >
      {/* Gradient ring - Instagram style */}
      <div
        className="rounded-full p-0.75 transition-transform duration-200 group-hover:scale-105"
        style={{
          background: post.is_pinned
            ? "linear-gradient(135deg, #2C5BFF 0%, #5a7dff 60%, #2C5BFF 100%)"
            : "linear-gradient(135deg, #F5A623 0%, #2C5BFF 50%, #5a7dff 100%)",
        }}
      >
        <div className="rounded-full border-2 border-cream">
          {firstImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={firstImage}
              alt={post.body?.slice(0, 40) ?? "Highlight"}
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex size-16 items-center justify-center rounded-full font-serif text-lg text-cream"
              style={{
                background: post.is_pinned
                  ? "linear-gradient(135deg, #1E40D6 0%, #2C5BFF 100%)"
                  : "linear-gradient(135deg, #0B1220 0%, #1a2744 100%)",
              }}
            >
              {snippet}
            </div>
          )}
        </div>
      </div>
      <span className="max-w-18 truncate text-center text-[11px] text-ash">
        {post.is_pinned ? "Pinned" : "Highlight"}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Post Card
// ---------------------------------------------------------------------------

function RepostCard({ post }: { post: PostWithAuthor }) {
  const original = post.reposted_from && !post.reposted_from.deleted_at ? post.reposted_from : null;
  const href = original ? `/p/${original.short_id}` : `/p/${post.short_id}`;

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-bone bg-paper p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm"
    >
      {/* Reposted header */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-ash">
        <Repeat2 className="size-3.5" strokeWidth={1.75} />
        <span>You reposted</span>
        <span className="text-ash" aria-hidden>&middot;</span>
        <span>{timeAgo(post.created_at)}</span>
      </div>

      {/* Reposter's optional added body */}
      {post.body ? (
        <p className="mb-3 line-clamp-2 whitespace-pre-line text-sm leading-relaxed text-ink">
          {post.body}
        </p>
      ) : null}

      {/* Embedded original */}
      <EmbeddedOriginal original={original} />
    </Link>
  );
}

function EmbeddedOriginal({ original }: { original: RepostedOriginal | null }) {
  if (!original) {
    return (
      <div className="rounded-xl border border-bone bg-cream/40 p-4 text-sm italic text-ash">
        Original post is no longer available.
      </div>
    );
  }
  const img = original.image_urls?.[0];
  return (
    <div className="rounded-xl border border-bone bg-cream/40 p-4">
      <div className="flex items-center gap-2.5">
        <Avatar name={original.author?.name ?? "Unknown"} size="sm" className="shrink-0 ring-1 ring-bone" />
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
          <span className="truncate text-sm font-semibold text-ink">{original.author?.name ?? "Unknown"}</span>
          {original.author?.handle ? (
            <span className="truncate text-xs text-ash">@{original.author.handle}</span>
          ) : null}
          <span className="text-xs text-ash select-none" aria-hidden>&middot;</span>
          <span className="text-xs text-ash">{timeAgo(original.created_at)}</span>
        </div>
      </div>

      {original.body ? (
        <p className="mt-2.5 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-ink/90">
          {original.body}
        </p>
      ) : null}

      {img ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={img} alt="" className="mt-3 h-44 w-full rounded-lg border border-bone object-cover" />
      ) : null}

      <div className="mt-3 flex items-center gap-4 text-xs text-ash">
        <span className="flex items-center gap-1.5">
          <Heart className="size-3.5" strokeWidth={1.75} />
          {(original.like_count ?? 0).toLocaleString("en-IN")}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-3.5" strokeWidth={1.75} />
          {(original.comment_count ?? 0).toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}

/**
 * Wraps a profile post/repost card with an owner-only delete control. The card
 * itself is a full-card <Link>, so the delete button stops propagation and
 * prevents navigation, then deletes via the server action and hides on success.
 */
function ManagedPostCard({ post, canManage }: { post: PostWithAuthor; canManage: boolean }) {
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (removed) return null;

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePostAction(post.id);
      if (res.ok) setRemoved(true);
      else setError(res.error ?? "Could not delete.");
    });
  }

  return (
    <div className="relative">
      <PostCard post={post} />
      {canManage ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Delete post"
          title="Delete post"
          className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full border border-bone bg-paper/90 text-ash backdrop-blur transition-colors hover:border-ember hover:text-ember disabled:opacity-40"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}
      {error ? (
        <p className="absolute inset-x-3 bottom-3 z-10 rounded-md bg-ember/10 px-2 py-1 text-xs text-ember">{error}</p>
      ) : null}
    </div>
  );
}

function PostCard({ post }: { post: PostWithAuthor }) {
  if (post.is_repost) {
    return <RepostCard post={post} />;
  }

  return (
    <Link
      href={`/p/${post.short_id}`}
      className="group block overflow-hidden rounded-xl border border-bone bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm"
    >
      {/* Image - full bleed if present */}
      {(post.image_urls?.length ?? 0) > 0 ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={post.image_urls![0]}
          alt=""
          className="h-52 w-full object-cover"
        />
      ) : null}

      <div className="px-5 py-4">
        {/* Pin badge */}
        {post.is_pinned ? (
          <div className="mb-2 flex items-center gap-1.5 text-xs" style={{ color: "#2C5BFF" }}>
            <Pin className="size-3.5" strokeWidth={1.75} />
            <span>Pinned post</span>
          </div>
        ) : null}

        <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-ink">
          {post.body}
        </p>

        {/* Engagement row */}
        <div className="mt-4 flex items-center gap-5 border-t border-bone pt-3 text-xs text-ash">
          <span className="flex items-center gap-1.5">
            <Heart className="size-3.5" strokeWidth={1.75} />
            {post.like_count.toLocaleString("en-IN")}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-3.5" strokeWidth={1.75} />
            {post.comment_count.toLocaleString("en-IN")}
          </span>
          <span className="ml-auto text-[11px] text-ash">
            {timeAgo(post.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Project Card
// ---------------------------------------------------------------------------

function ProjectCard({ project }: { project: ProfileProject }) {
  const statusLabel =
    project.status === "open"
      ? "Open"
      : project.status.replace(/_/g, " ");

  return (
    <Link
      href={`/c/${project.short_id}`}
      className="group flex flex-col rounded-xl border border-bone bg-paper p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug text-ink group-hover:text-saffron transition-colors">
          {project.title}
        </h3>
        <Tag variant={project.status === "open" ? "saffron" : "default"} className="shrink-0 capitalize">
          {statusLabel}
        </Tag>
      </div>
      {project.brief ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ash">
          {project.brief}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-ash">
        <Layers className="size-3.5" strokeWidth={1.75} />
        <span>{project.slot_count} {project.slot_count === 1 ? "slot" : "slots"} open</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Verified Contribution Card
// ---------------------------------------------------------------------------

function VerifiedContributionCard({ contribution }: { contribution: VerifiedContribution }) {
  const { role, project } = contribution;
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-bone bg-paper px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Tag variant="moss" className="text-xs">Verified contributor</Tag>
          {role === "owner" ? <Tag variant="saffron" className="text-xs">Author</Tag> : null}
        </div>
        <Link
          href={`/c/${project.short_id}`}
          className="mt-2 block text-sm font-medium text-ink hover:underline"
        >
          {project.title}
        </Link>
        <p className="mt-0.5 text-xs text-ash">
          {project.author ? `by @${project.author.handle}` : null}
          {project.delivered_at
            ? `${project.author ? " " : ""}delivered ${new Date(project.delivered_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`
            : ""}
        </p>
      </div>
      {project.deliverable_url ? (
        <a
          href={project.deliverable_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 text-xs text-ash transition-colors hover:text-ink"
        >
          View <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  message,
  cta,
}: {
  icon: React.ReactNode;
  message: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-bone bg-paper/60 py-20 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full"
        style={{ background: "rgba(44,91,255,0.07)" }}
      >
        <span style={{ color: "#2C5BFF" }}>{icon}</span>
      </div>
      <p className="max-w-xs text-sm leading-relaxed text-ash">{message}</p>
      {cta ? <div className="mt-1">{cta}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<TabId, React.ReactNode> = {
  posts: <BookOpen className="size-3.5" strokeWidth={1.75} />,
  projects: <Layers className="size-3.5" strokeWidth={1.75} />,
  highlights: <Star className="size-3.5" strokeWidth={1.75} />,
  about: <Info className="size-3.5" strokeWidth={1.75} />,
};

export function ProfileTabs({
  posts,
  projects = [],
  verifiedProjects = [],
  bio,
  college,
  branch,
  city,
  year_of_study,
  accountType,
  interests = [],
  socialLinks = [],
  currentUserId,
  isOwner = false,
}: ProfileTabsProps) {
  const [tab, setTab] = useState<TabId>("posts");
  const highlights = posts.filter((p) => p.is_pinned || p.is_highlight);
  const projectsCount = projects.length + verifiedProjects.length;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "posts", label: "Posts", count: posts.length },
    { id: "projects", label: "Projects", count: projectsCount },
    { id: "highlights", label: "Highlights", count: highlights.length },
    { id: "about", label: "About" },
  ];

  const yearLabel = year_of_study
    ? { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year", "5": "5th Year" }[year_of_study] ?? `Year ${year_of_study}`
    : null;
  const accountLabel = accountType
    ? accountType.charAt(0).toUpperCase() + accountType.slice(1)
    : null;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* TAB BAR                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-10 overflow-x-auto border-b border-bone no-scrollbar">
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors duration-150 sm:px-4",
                tab === t.id ? "text-ink" : "text-ash hover:text-ink"
              )}
            >
              <span
                className={cn(
                  "transition-colors duration-150",
                  tab === t.id ? "text-saffron" : "text-ash group-hover:text-ink"
                )}
              >
                {TAB_ICONS[t.id]}
              </span>
              {t.label}
              {t.count != null && t.count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none transition-colors",
                    tab === t.id
                      ? "bg-saffron/10 text-saffron-dk"
                      : "bg-bone text-ash"
                  )}
                >
                  {t.count}
                </span>
              ) : null}
              {/* Active underline */}
              {tab === t.id ? (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-saffron"
                  style={{ background: "#2C5BFF" }}
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* POSTS TAB                                                           */}
      {/* ------------------------------------------------------------------ */}
      {tab === "posts" && (
        <Reveal delay={0.05}>
          {posts.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-5" strokeWidth={1.5} />}
              message="Nothing posted yet. Share what you are working on."
            />
          ) : (
            <Stagger className="mt-8 grid gap-4 sm:grid-cols-2" step={0.05}>
              {posts.map((p) => (
                <ManagedPostCard
                  key={p.id}
                  post={p}
                  canManage={isOwner && !!currentUserId && currentUserId === p.author_id}
                />
              ))}
            </Stagger>
          )}
        </Reveal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* PROJECTS TAB                                                        */}
      {/* ------------------------------------------------------------------ */}
      {tab === "projects" && (
        <Reveal delay={0.05}>
          {projectsCount === 0 ? (
            <EmptyState
              icon={<Layers className="size-5" strokeWidth={1.5} />}
              message={isOwner ? "No projects posted yet. Start a collaboration brief." : "No projects to show yet."}
              cta={
                isOwner ? (
                  <Link
                    href="/collabs/new"
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-cream transition-opacity hover:opacity-90"
                    style={{ background: "#2C5BFF" }}
                  >
                    Post a brief
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="mt-8 flex flex-col gap-8">
              {projects.length > 0 ? (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-caption text-ash">
                    <Layers className="size-4" strokeWidth={1.75} />
                    {isOwner ? "Your projects" : "Authored projects"}
                  </h3>
                  <Stagger className="grid gap-4 sm:grid-cols-2" step={0.05}>
                    {projects.map((pr) => (
                      <ProjectCard key={pr.id} project={pr} />
                    ))}
                  </Stagger>
                </div>
              ) : null}

              {verifiedProjects.length > 0 ? (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-caption text-ash">
                    <BadgeCheck className="size-4 text-saffron" strokeWidth={1.75} />
                    Verified contributions
                  </h3>
                  <Stagger className="flex flex-col gap-3" step={0.05}>
                    {verifiedProjects.map((m) => (
                      <VerifiedContributionCard key={m.project.id} contribution={m} />
                    ))}
                  </Stagger>
                </div>
              ) : null}
            </div>
          )}
        </Reveal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* HIGHLIGHTS TAB                                                      */}
      {/* ------------------------------------------------------------------ */}
      {tab === "highlights" && (
        <Reveal delay={0.05}>
          {highlights.length === 0 ? (
            <EmptyState
              icon={<Star className="size-5" strokeWidth={1.5} />}
              message={isOwner ? "Pin a post or save a repost to feature it here as a highlight." : "No highlights yet."}
            />
          ) : (
            <>
              {/* Story bubbles row - Instagram highlights */}
              <div className="mt-8 overflow-x-auto">
                <div className="flex gap-6 pb-2 no-scrollbar">
                  {highlights.map((p) => (
                    <HighlightBubble key={p.id} post={p} />
                  ))}
                </div>
              </div>

              {/* Full cards below the bubbles */}
              <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3" step={0.05}>
                {highlights.map((p) => (
                  <Link
                    key={p.id}
                    href={`/p/${p.short_id}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-bone bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron hover:shadow-sm"
                  >
                    {(p.image_urls?.length ?? 0) > 0 ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.image_urls![0]}
                        alt=""
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-24 items-center justify-center"
                        style={{
                          background: p.is_pinned
                            ? "linear-gradient(135deg,#1E40D6,#2C5BFF)"
                            : "linear-gradient(135deg,#0B1220,#1a2744)",
                        }}
                      >
                        <Star className="size-8 text-cream/30" strokeWidth={1} />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="mb-2">
                        <Tag variant={p.is_pinned ? "saffron" : "default"}>
                          {p.is_pinned ? "Pinned" : "Highlight"}
                        </Tag>
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-ink">
                        {p.body}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-ash">
                        <span className="flex items-center gap-1">
                          <Heart className="size-3" strokeWidth={1.75} />
                          {p.like_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="size-3" strokeWidth={1.75} />
                          {p.comment_count}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </Stagger>
            </>
          )}
        </Reveal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ABOUT TAB                                                           */}
      {/* ------------------------------------------------------------------ */}
      {tab === "about" && (
        <Reveal delay={0.05}>
          {(() => {
            const detailRows: { icon: React.ReactNode; label: string; value: string }[] = [];
            if (college) detailRows.push({ icon: <GraduationCap className="size-4" strokeWidth={1.75} />, label: "College", value: college });
            if (branch) detailRows.push({ icon: <Layers className="size-4" strokeWidth={1.75} />, label: "Branch", value: branch });
            if (yearLabel) detailRows.push({ icon: <Calendar className="size-4" strokeWidth={1.75} />, label: "Year", value: yearLabel });
            if (city) detailRows.push({ icon: <MapPin className="size-4" strokeWidth={1.75} />, label: "City", value: city });
            if (accountLabel) detailRows.push({ icon: <Briefcase className="size-4" strokeWidth={1.75} />, label: "Account", value: accountLabel });

            const hasAnything = !!bio || detailRows.length > 0 || interests.length > 0 || socialLinks.length > 0;
            if (!hasAnything) {
              return (
                <EmptyState
                  icon={<Info className="size-5" strokeWidth={1.5} />}
                  message={isOwner ? "Add your bio, education, and interests to help others know who you are." : "This profile has no details yet."}
                  cta={
                    isOwner ? (
                      <Link
                        href="/profile/edit"
                        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-cream transition-opacity hover:opacity-90"
                        style={{ background: "#2C5BFF" }}
                      >
                        Complete profile
                      </Link>
                    ) : undefined
                  }
                />
              );
            }

            return (
              <div className="mt-8 space-y-6">
                {/* Bio block */}
                {bio ? (
                  <div className="rounded-xl border border-bone bg-paper p-6">
                    <h2 className="mb-3 font-serif text-lg text-ink" style={{ letterSpacing: "-0.01em" }}>Bio</h2>
                    <p className="whitespace-pre-line leading-relaxed text-ink">{bio}</p>
                  </div>
                ) : null}

                {/* Details block */}
                {detailRows.length > 0 ? (
                  <div className="rounded-xl border border-bone bg-paper p-6">
                    <h2 className="mb-4 font-serif text-lg text-ink" style={{ letterSpacing: "-0.01em" }}>Details</h2>
                    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      {detailRows.map((row) => (
                        <div key={row.label} className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cream text-ash">
                            {row.icon}
                          </span>
                          <span className="min-w-0">
                            <dt className="text-[11px] uppercase tracking-wider text-ash">{row.label}</dt>
                            <dd className="truncate text-sm font-medium text-ink">{row.value}</dd>
                          </span>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                {/* Interests block */}
                {interests.length > 0 ? (
                  <div className="rounded-xl border border-bone bg-paper p-6">
                    <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-ink" style={{ letterSpacing: "-0.01em" }}>
                      <TagIcon className="size-4 text-ash" strokeWidth={1.75} /> Interests
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {interests.map((i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-bone px-3.5 py-1.5 text-sm text-ink">
                          <span className="size-1.5 rounded-full" style={{ background: "#2C5BFF" }} />
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Links block */}
                {socialLinks.length > 0 ? (
                  <div className="rounded-xl border border-bone bg-paper p-6">
                    <h2 className="mb-4 font-serif text-lg text-ink" style={{ letterSpacing: "-0.01em" }}>Links</h2>
                    <div className="flex flex-wrap gap-2">
                      {socialLinks.map((l) => (
                        <a
                          key={l.platform}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-bone bg-paper px-4 py-1.5 text-sm text-ink transition-colors hover:border-saffron hover:text-saffron-dk"
                        >
                          {l.label}
                          <ExternalLink className="size-3.5 text-ash" strokeWidth={1.75} />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </Reveal>
      )}
    </>
  );
}
