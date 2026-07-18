import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicTopNav } from "@/components/layout/PublicTopNav";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Calendar, Users, Briefcase, ExternalLink, ArrowLeft, BadgeCheck } from "lucide-react";
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

  const statusBadgeVariant = (s: string) => {
    if (s === "open") return "saffron" as const;
    if (s === "team_formed" || s === "in_progress") return "moss" as const;
    return "outline" as const;
  };

  const isDelivered = !!project.delivered_at;

  return (
    <main className="min-h-dvh bg-cream">
      <PublicTopNav />
      <div className="container-edit max-w-3xl pt-28 pb-20 md:pt-32">
        <Reveal>
          <Link
            href="/collabs"
            className="inline-flex items-center gap-2 text-sm text-ash transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Back to Collabs
          </Link>
          <p className="mt-6 text-caption text-ash">Collab Project</p>
          <h1 className="mt-4 font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
            {project.title}
          </h1>
        </Reveal>

        <Reveal delay={0.1}>
          <Link
            href={`/u/${project.author.handle}`}
            className="mt-6 flex items-center gap-3"
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

        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap items-center gap-6 border-y border-bone py-4 text-sm text-ash">
            <span className="flex items-center gap-2">
              <Calendar className="size-4" />
              Due{" "}
              {new Date(project.deadline).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4" />
              {project.status === "open"
                ? openSlots > 0
                  ? `${openSlots} of ${project.slot_count} slots open`
                  : "Team full"
                : `${project.slot_count} slots`}
            </span>
            <span className="flex items-center gap-2">
              <Briefcase className="size-4" />
              <Tag variant={statusBadgeVariant(project.status)} className="text-xs">
                {project.status.replace("_", " ")}
              </Tag>
            </span>
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

        <Reveal delay={0.2}>
          <section className="mt-10">
            <h2 className="text-caption text-ash">Brief</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-body text-ink">
              {project.brief}
            </p>
          </section>
          <section className="mt-8">
            <h2 className="text-caption text-ash">Deliverable</h2>
            <p className="mt-2 text-body text-ink">{project.deliverable}</p>
          </section>
        </Reveal>

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
                    {appState.status === "accepted" &&
                      "You are on the team."}
                    {appState.status === "rejected" &&
                      "Better luck next time."}
                  </span>
                </div>
              ) : acceptsApplications ? (
                <ApplyForm
                  projectId={project.id}
                  shortId={short_id}
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
                    className="flex items-center gap-2 rounded-lg border border-bone bg-paper px-3 py-2 transition-all hover:-translate-y-0.5 hover:border-ink/30"
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
