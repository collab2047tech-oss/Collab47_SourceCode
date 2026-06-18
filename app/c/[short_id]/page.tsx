import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Calendar, Users, Briefcase } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getProjectByShortId,
  getProjectApplications,
  getProjectMembers,
  getMyProjectApplicationState,
} from "@/lib/db/projects";
import { ApplyForm } from "@/components/composite/ApplyForm";
import { ApplicationsPanel } from "@/components/composite/ApplicationsPanel";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ short_id: string }>;
}) {
  const { short_id } = await params;
  const sb = await getSupabaseServer();

  // --- Mock fallback when Supabase is not configured ---
  if (!sb) {
    return (
      <main className="min-h-dvh bg-cream">
        <Nav />
        <div className="container-edit max-w-3xl pt-32 pb-20">
          <p className="text-caption text-ash">Collab Project</p>
          <h1 className="mt-4 font-serif text-5xl text-ink">
            The Anti-Bias{" "}
            <span className="italic text-saffron">Hiring Lab.</span>
          </h1>
          <p className="mt-4 text-body-sm text-ash">
            Posted by Akshpreet . open until 30 June 2026
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Tag variant="saffron">5 slots</Tag>
            <Tag variant="outline">Design</Tag>
            <Tag variant="outline">Research</Tag>
          </div>
          <div className="mt-12 space-y-6">
            <section>
              <h2 className="text-caption text-ash">Brief</h2>
              <p className="mt-2 text-body text-ink">
                A coalition of Tier-2/3 student designers and engineers
                rebuilding the campus hiring stack from scratch. Deliverable: a
                working anti-bias scoring algorithm + a public Figma case study.
              </p>
            </section>
            <section>
              <h2 className="text-caption text-ash">Deliverable</h2>
              <p className="mt-2 text-body text-ink">
                Open-source scoring algorithm + public case study by 25 July.
              </p>
            </section>
          </div>
          <div className="mt-12">
            <Link href="/login">
              <Button size="lg">Apply with a pitch</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // --- Real data path ---
  const project = await getProjectByShortId(short_id);

  if (!project) {
    return (
      <main className="min-h-dvh bg-cream">
        <Nav />
        <div className="container-edit pt-40">
          <h1 className="font-serif text-5xl text-ink">
            Project{" "}
            <span className="italic text-saffron">not found.</span>
          </h1>
        </div>
      </main>
    );
  }

  const {
    data: { user },
  } = await sb.auth.getUser();

  const isAuthor = user?.id === project.author_id;

  const [applications, members, appState] = await Promise.all([
    isAuthor ? getProjectApplications(project.id) : Promise.resolve([]),
    getProjectMembers(project.id),
    !isAuthor && user
      ? getMyProjectApplicationState(project.id)
      : Promise.resolve({ applied: false, status: null }),
  ]);

  const statusBadgeVariant = (s: string) => {
    if (s === "open") return "saffron" as const;
    if (s === "team_formed" || s === "in_progress") return "moss" as const;
    return "outline" as const;
  };

  return (
    <main className="min-h-dvh bg-cream">
      <Nav />
      <div className="container-edit max-w-3xl pt-32 pb-20">
        <Reveal>
          <p className="text-caption text-ash">Collab Project</p>
          <h1 className="mt-4 font-serif text-5xl text-ink">
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
              {project.slot_count} slots
            </span>
            <span className="flex items-center gap-2">
              <Briefcase className="size-4" />
              <Tag variant={statusBadgeVariant(project.status)} className="text-xs">
                {project.status.replace("_", " ")}
              </Tag>
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <section className="mt-10">
            <h2 className="text-caption text-ash">Brief</h2>
            <p className="mt-2 whitespace-pre-wrap text-body text-ink">
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
              ) : (
                <ApplyForm
                  projectId={project.id}
                  shortId={short_id}
                />
              )}
            </div>
          </Reveal>
        )}

        {!isAuthor && !user && (
          <Reveal delay={0.25}>
            <div className="mt-12">
              <Link href="/login">
                <Button size="lg">Apply with a pitch</Button>
              </Link>
            </div>
          </Reveal>
        )}

        {/* Author: applications panel */}
        {isAuthor && (
          <Reveal delay={0.25}>
            <div className="mt-12">
              <ApplicationsPanel
                projectId={project.id}
                shortId={short_id}
                applications={applications as Parameters<typeof ApplicationsPanel>[0]["applications"]}
              />
            </div>
          </Reveal>
        )}

        {/* Team members */}
        {members.length > 0 && (
          <Reveal delay={0.3}>
            <div className="mt-12">
              <h2 className="text-caption text-ash">Team</h2>
              <div className="mt-4 flex flex-wrap gap-4">
                {(members as Array<{ user_id: string; role: string; profile: { id: string; handle: string; name: string; avatar_url: string | null } }>).map((m) => (
                  <Link
                    key={m.user_id}
                    href={`/u/${m.profile.handle}`}
                    className="flex items-center gap-2 rounded-lg border border-bone bg-paper px-3 py-2 transition-colors hover:border-ink/30"
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
                      <p className="text-xs text-ash">
                        {m.role === "owner" ? "Author" : "Member"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </main>
  );
}
