import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicTopNav } from "@/components/layout/PublicTopNav";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Users, Clock, CalendarRange, Calendar, ExternalLink, ArrowLeft, BadgeCheck } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getProjectByShortId,
  getProjectApplications,
  getProjectMembers,
  getMyProjectApplicationState,
  getProjectProgressPosts,
} from "@/lib/db/projects";
import { ApplyForm } from "@/components/composite/ApplyForm";
import { ApplicationsPanel } from "@/components/composite/ApplicationsPanel";
import { ProgressComposer } from "@/components/composite/ProgressComposer";
import { DeliverForm } from "@/components/composite/DeliverForm";

const CATEGORY_LABELS: Record<string, string> = {
  web: "Web",
  mobile: "Mobile",
  ml: "ML / AI",
  research: "Research",
  design: "Design",
  hardware: "Hardware",
  social: "Social impact",
  other: "Other",
};

interface Role {
  title: string;
  skills: string[];
  count: number;
}

/** First sentence (or a clamp) of the brief - the hero one-liner. */
function leadLine(brief: string): string {
  const t = (brief ?? "").trim();
  if (!t) return "";
  const stop = t.search(/[.!?]\s/);
  if (stop > 0 && stop < 180) return t.slice(0, stop + 1);
  return t.length > 160 ? `${t.slice(0, 160).trimEnd()}...` : t;
}

/** Map the stored commitment int back to its honest band label. */
function commitmentLabel(h: number | null): string | null {
  if (h == null) return null;
  if (h < 5) return "< 5 hrs/week";
  if (h < 10) return "5-10 hrs/week";
  if (h < 20) return "10-20 hrs/week";
  return "20+ hrs/week";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ short_id: string }>;
}): Promise<Metadata> {
  const { short_id } = await params;
  const sb = await getSupabaseServer();
  const project = sb ? await getProjectByShortId(short_id) : null;

  if (!project) {
    return { title: "Project not found", robots: { index: false, follow: false } };
  }

  const title = project.title as string;
  const brief = project.brief as string | null;
  const description = brief ? brief.slice(0, 160) : "Open collaboration on Collab47";
  const canonical = `/c/${short_id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ short_id: string }>;
}) {
  const { short_id } = await params;
  const sb = await getSupabaseServer();

  const project = sb ? await getProjectByShortId(short_id) : null;

  if (!project) {
    notFound();
  }

  // project is non-null here, so sb is guaranteed configured.
  const {
    data: { user },
  } = await sb!.auth.getUser();

  const isAuthor = user?.id === project.author_id;

  const [applications, members, appState, progressPosts] = await Promise.all([
    isAuthor ? getProjectApplications(project.id) : Promise.resolve([]),
    getProjectMembers(project.id),
    !isAuthor && user
      ? getMyProjectApplicationState(project.id)
      : Promise.resolve({ applied: false, status: null }),
    getProjectProgressPosts(project.id),
  ]);

  const isMember = user
    ? (members as Array<{ user_id: string }>).some((m) => m.user_id === user.id)
    : false;

  // Owner holds one membership row; remaining open slots = requested slots minus
  // accepted (non-owner) members. Used to gate the apply form when a team fills.
  const acceptedMembers = Math.max(0, members.length - 1);
  const openSlots = Math.max(0, (project.slot_count as number) - acceptedMembers);
  const acceptsApplications = project.status === "open" && openSlots > 0;

  // Structured fields (legacy rows: roles=[], nulls elsewhere).
  const roles: Role[] = Array.isArray(project.roles) ? (project.roles as Role[]) : [];
  const category = project.category as string | null;
  const categoryLabel = category ? CATEGORY_LABELS[category] ?? "Other" : null;
  const duration = (project.duration as string | null) ?? null;
  const commitment = commitmentLabel((project.commitment_hours as number | null) ?? null);
  const oneLiner = leadLine(project.brief as string);

  const isDelivered = !!project.delivered_at;
  const canApply = !isAuthor && !!user && acceptsApplications && !appState.applied;

  const statusBadgeVariant = (s: string) => {
    if (s === "open") return "saffron" as const;
    if (s === "team_formed" || s === "in_progress") return "moss" as const;
    return "outline" as const;
  };

  // Match the casing used on the Collabs list (/collabs) so the same status
  // never reads as "Open" there and "open" here.
  const statusLabel = (s: string) => {
    if (s === "open") return "Open";
    if (s === "team_formed") return "Team formed";
    if (s === "in_progress") return "In progress";
    if (s === "delivered") return "Delivered";
    if (s === "closed") return "Closed";
    return s.replace("_", " ");
  };

  return (
    <main className="min-h-dvh bg-cream">
      <PublicTopNav />
      <div className="container-edit max-w-3xl pt-28 pb-20 md:pt-32">
        {/* Hero */}
        <Reveal>
          <Link
            href="/collabs"
            className="inline-flex items-center gap-2 rounded-md text-sm text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
          >
            <ArrowLeft className="size-4" /> Back to Collabs
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {categoryLabel && <Tag variant="outline">{categoryLabel}</Tag>}
            <Tag variant={statusBadgeVariant(project.status)}>
              {statusLabel(project.status)}
            </Tag>
          </div>

          <h1 className="mt-4 font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
            {project.title}
          </h1>

          {oneLiner && (
            <p className="mt-4 text-body-lg text-ash">{oneLiner}</p>
          )}
        </Reveal>

        <Reveal delay={0.1}>
          <Link
            href={`/u/${project.author.handle}`}
            className="mt-6 inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
          >
            <Avatar
              name={project.author.name}
              src={project.author.avatar_url ?? undefined}
              size="sm"
            />
            <span className="text-sm text-ash">
              Posted by @{project.author.handle}
            </span>
          </Link>
        </Reveal>

        {/* Meta bar: commitment + duration when present; legacy shows the deadline. */}
        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-bone py-4 text-sm text-ash">
            {commitment && (
              <span className="flex items-center gap-2">
                <Clock className="size-4" /> {commitment}
              </span>
            )}
            {duration && (
              <span className="flex items-center gap-2">
                <CalendarRange className="size-4" /> {duration}
              </span>
            )}
            {!commitment && !duration && (
              <span className="flex items-center gap-2">
                <Calendar className="size-4" />
                Due{" "}
                {new Date(project.deadline).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {project.status === "open" && (
              <span className="flex items-center gap-2">
                <Users className="size-4" />
                {openSlots > 0 ? "Open to applicants" : "Team full"}
              </span>
            )}
          </div>
        </Reveal>

        {/* Delivered banner */}
        {isDelivered && (
          <Reveal delay={0.17}>
            <div className="mt-6 flex flex-col gap-2 rounded-lg border border-moss/30 bg-moss/5 px-5 py-4">
              <p className="text-sm font-medium text-moss">Project delivered</p>
              {project.deliverable_url ? (
                <a
                  href={project.deliverable_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-ink underline underline-offset-2 hover:text-saffron"
                >
                  View deliverable <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          </Reveal>
        )}

        {/* The work */}
        <Reveal delay={0.2}>
          <section className="mt-10">
            <h2 className="text-caption text-ash">The work</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-body text-ink">
              {project.brief}
            </p>
          </section>
          <section className="mt-8">
            <h2 className="text-caption text-ash">Deliverable</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-body text-ink">
              {project.deliverable}
            </p>
          </section>
        </Reveal>

        {/* Roles needed (hidden for legacy projects with no roles) */}
        {roles.length > 0 && (
          <Reveal delay={0.22}>
            <section className="mt-10">
              <h2 className="text-caption text-ash">Roles needed</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {roles.map((role, i) => (
                  <div
                    key={`${role.title}-${i}`}
                    className="flex flex-col rounded-lg border border-bone bg-paper p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-ink">{role.title}</h3>
                      <span className="shrink-0 text-xs text-ash">
                        {role.count} needed
                      </span>
                    </div>
                    {role.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {role.skills.map((s) => (
                          <Tag key={s} variant="default" className="text-[11px]">
                            {s}
                          </Tag>
                        ))}
                      </div>
                    )}
                    {canApply && (
                      <a
                        href={`#apply-role-${i}`}
                        className="mt-4 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-saffron underline-offset-4 transition-colors hover:text-saffron-dk hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                      >
                        Apply for this role
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* Apply section (viewers only) */}
        {!isAuthor && user && (
          <Reveal delay={0.25}>
            <div className="mt-12">
              {appState.applied ? (
                <div className="flex items-center gap-3">
                  <Tag
                    variant={
                      appState.status === "accepted"
                        ? "moss"
                        : appState.status === "rejected"
                        ? "outline"
                        : "saffron"
                    }
                  >
                    {appState.status === "accepted"
                      ? "Accepted"
                      : appState.status === "rejected"
                      ? "Not selected"
                      : "Application sent"}
                  </Tag>
                  <span className="text-sm text-ash">
                    {appState.status === "pending" &&
                      "The author will review your pitch."}
                    {appState.status === "accepted" && "You are on the team."}
                    {appState.status === "rejected" && "Better luck next time."}
                  </span>
                </div>
              ) : acceptsApplications ? (
                <ApplyForm
                  projectId={project.id}
                  shortId={short_id}
                  roles={roles.map((r) => r.title)}
                />
              ) : (
                <div className="rounded-lg border border-bone bg-paper px-6 py-5">
                  <p className="font-medium text-ink">
                    {isDelivered
                      ? "This project has been delivered."
                      : project.status === "open"
                      ? "This project's team is full."
                      : "This project is no longer accepting applications."}
                  </p>
                  <p className="mt-1 text-sm text-ash">
                    Browse other open briefs on the Collabs page.
                  </p>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {!isAuthor && !user && acceptsApplications && (
          <Reveal delay={0.25}>
            <div className="mt-12">
              <Link href="/login">
                <Button size="lg">Apply with a pitch</Button>
              </Link>
            </div>
          </Reveal>
        )}

        {/* Author: applications panel + mark-delivered */}
        {isAuthor && (
          <Reveal delay={0.25}>
            <div className="mt-12">
              <ApplicationsPanel
                projectId={project.id}
                shortId={short_id}
                applications={applications as Parameters<typeof ApplicationsPanel>[0]["applications"]}
              />
            </div>
            {!isDelivered && (
              <div className="mt-10">
                <h2 className="text-caption text-ash">Mark as delivered</h2>
                <p className="mt-1 text-sm text-ash">
                  Once marked, all members earn the Verified contributor badge on their portfolios.
                </p>
                <DeliverForm projectId={project.id} shortId={short_id} />
              </div>
            )}
          </Reveal>
        )}

        {/* Team members */}
        {members.length > 0 && (
          <Reveal delay={0.3}>
            <div className="mt-12">
              <h2 className="text-caption text-ash">Team</h2>
              <div className="mt-4 flex flex-wrap gap-4">
                {(members as Array<{ user_id: string; role: string; is_verified: boolean; profile: { id: string; handle: string; name: string; avatar_url: string | null } }>).map((m) => (
                  <Link
                    key={m.user_id}
                    href={`/u/${m.profile.handle}`}
                    className="flex items-center gap-2 rounded-lg border border-bone bg-paper px-3 py-2 transition-all hover:-translate-y-0.5 hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                  >
                    <Avatar
                      name={m.profile.name}
                      src={m.profile.avatar_url ?? undefined}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {m.profile.name}
                      </p>
                      {m.is_verified ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-moss">
                          <BadgeCheck className="size-3.5" /> Verified contributor
                        </span>
                      ) : (
                        <p className="text-xs text-ash">
                          {m.role === "owner" ? "Author" : "Member"}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* Progress updates composer (members only) */}
        {isMember && user && (
          <Reveal delay={0.35}>
            <div className="mt-12">
              <h2 className="text-caption text-ash">Post an update</h2>
              <ProgressComposer projectId={project.id} shortId={short_id} />
            </div>
          </Reveal>
        )}

        {/* Progress posts feed */}
        {progressPosts.length > 0 && (
          <Reveal delay={0.4}>
            <div className="mt-10">
              <h2 className="text-caption text-ash">Progress updates</h2>
              <div className="mt-4 flex flex-col gap-4">
                {(progressPosts as Array<{
                  id: string;
                  body: string;
                  created_at: string;
                  short_id: string;
                  author: { handle: string; name: string; avatar_url: string | null };
                }>).map((post) => (
                  <div
                    key={post.id}
                    className="rounded-lg border border-bone bg-paper px-5 py-4 transition-colors hover:border-ink/20"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar
                        name={post.author.name}
                        src={post.author.avatar_url ?? undefined}
                        size="xs"
                      />
                      <Link
                        href={`/u/${post.author.handle}`}
                        className="text-sm font-medium text-ink hover:underline"
                      >
                        @{post.author.handle}
                      </Link>
                      <span className="text-xs text-ash">
                        {new Date(post.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">
                      {post.body}
                    </p>
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
