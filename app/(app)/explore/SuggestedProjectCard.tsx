import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Users, ArrowRight } from "lucide-react";
import type { SuggestedProject } from "@/lib/db/social";

/**
 * A real, matched open project (ranked by interest/branch overlap + open slots),
 * not "the single newest project". Shows the match reason, open slots, brief,
 * and author. Links to the project brief at /c/[short_id].
 */
export function SuggestedProjectCard({ project }: { project: SuggestedProject }) {
  return (
    <Link
      href={`/c/${project.short_id}`}
      className="group flex h-full flex-col rounded-lg border border-bone bg-paper p-5 transition-all hover:-translate-y-0.5 hover:border-saffron/40 hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Tag variant="saffron">{project.reason}</Tag>
        {project.open_slots > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-moss">
            <Users className="size-3" />
            {project.open_slots} open
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 font-serif text-lg leading-snug text-ink transition-colors group-hover:text-saffron">
        {project.title}
      </h3>
      {project.brief ? (
        <p className="mt-2 line-clamp-2 text-sm text-ash">{project.brief}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2 pt-1 sm:mt-auto">
        {project.author ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={project.author.name} src={project.author.avatar_url ?? undefined} size="xs" />
            <span className="truncate text-xs text-ash">{project.author.name}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-saffron-dk">
          View brief <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
