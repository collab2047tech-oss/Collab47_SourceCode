import Link from "next/link";
import { listOpenProjects } from "@/lib/db/projects";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Calendar, Users } from "lucide-react";

export default async function CollabsPage() {
  const projects = await listOpenProjects(20);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <Reveal>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-caption text-ash">Collab Projects</p>
            <h1 className="mt-2 font-serif text-display-md text-ink leading-tight">
              Briefs from industry.{" "}
              <span className="italic text-saffron">Teams from campus.</span>
            </h1>
          </div>
          <Link href="/collabs/new" className="mt-2 shrink-0">
            <Button variant="primary" size="md">
              Post a brief
            </Button>
          </Link>
        </div>
      </Reveal>

      {/* Projects grid */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {projects.map((project, i) => {
          const p = project as {
            id: string;
            short_id: string;
            title: string;
            brief: string;
            deadline: string;
            slot_count: number;
            status: string;
            author: { id: string; handle: string; name: string; avatar_url: string | null };
          };
          return (
            <Reveal key={p.id} delay={i * 0.05}>
              <Link
                href={`/c/${p.short_id}`}
                className="group flex h-full flex-col rounded-lg border border-bone bg-paper p-5 transition-all duration-200 hover:border-ink/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink group-hover:text-saffron transition-colors line-clamp-2">
                    {p.title}
                  </h2>
                  <Tag variant="saffron" className="shrink-0">
                    {p.status === "open" ? "Open" : p.status.replace("_", " ")}
                  </Tag>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Avatar
                    name={p.author.name}
                    src={p.author.avatar_url ?? undefined}
                    size="xs"
                  />
                  <span className="text-xs text-ash">@{p.author.handle}</span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-ash">
                  {p.brief}
                </p>

                <div className="mt-auto pt-4 flex items-center gap-4 text-xs text-ash">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {new Date(p.deadline).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {p.slot_count} slots
                  </span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>

      {projects.length === 0 && (
        <Reveal delay={0.1}>
          <div className="mt-16 text-center">
            <p className="text-body text-ash">No open projects yet.</p>
            <p className="mt-2 text-sm text-ash">
              Be the first to post a brief.
            </p>
            <Link href="/collabs/new" className="mt-6 inline-block">
              <Button variant="primary" size="md">
                Post a brief
              </Button>
            </Link>
          </div>
        </Reveal>
      )}
    </div>
  );
}
