import Link from "next/link";
import { listProjects, type ProjectListFilter } from "@/lib/db/projects";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Calendar, Users, Search } from "lucide-react";

const FILTERS: { key: ProjectListFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "forming", label: "Forming" },
  { key: "delivered", label: "Delivered" },
  { key: "all", label: "All" },
];

function statusLabel(status: string) {
  if (status === "open") return "Open";
  if (status === "team_formed") return "Team formed";
  if (status === "in_progress") return "In progress";
  if (status === "delivered") return "Delivered";
  if (status === "closed") return "Closed";
  return status.replace("_", " ");
}

function statusVariant(status: string) {
  if (status === "open") return "saffron" as const;
  if (status === "team_formed" || status === "in_progress") return "moss" as const;
  return "outline" as const;
}

export default async function CollabsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter: ProjectListFilter = FILTERS.some((f) => f.key === sp.filter)
    ? (sp.filter as ProjectListFilter)
    : "open";
  const search = (sp.q ?? "").trim();

  const projects = await listProjects({ filter, search, limit: 24 });

  const buildHref = (next: Partial<{ filter: string; q: string }>) => {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const q = next.q ?? search;
    if (f && f !== "open") params.set("filter", f);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/collabs?${qs}` : "/collabs";
  };

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

      {/* Filters + search */}
      <Reveal delay={0.05}>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ filter: f.key })}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-ink bg-ink text-cream"
                      : "border-bone bg-paper text-ash hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          <form action="/collabs" method="get" className="relative">
            {filter !== "open" && (
              <input type="hidden" name="filter" value={filter} />
            )}
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ash" />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search briefs..."
              className="h-10 w-full rounded-full border border-bone bg-paper pl-9 pr-4 text-sm text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none sm:w-64"
            />
          </form>
        </div>
      </Reveal>

      {/* Projects grid */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {projects.map((project, i) => {
          const p = project as {
            id: string;
            short_id: string;
            title: string;
            brief: string;
            deadline: string;
            slot_count: number;
            status: string;
            member_count: number;
            author: { id: string; handle: string; name: string; avatar_url: string | null };
          };
          // Owner occupies one membership row; remaining open slots = requested
          // slots minus accepted (non-owner) members.
          const acceptedMembers = Math.max(0, (p.member_count ?? 1) - 1);
          const openSlots = Math.max(0, p.slot_count - acceptedMembers);
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
                  <Tag variant={statusVariant(p.status)} className="shrink-0">
                    {statusLabel(p.status)}
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
                    {p.status === "open"
                      ? openSlots > 0
                        ? `${openSlots} of ${p.slot_count} slots open`
                        : "Team full"
                      : `${p.slot_count} slots`}
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
            <p className="text-body text-ash">
              {search
                ? "No briefs match your search."
                : filter === "open"
                ? "No open projects yet."
                : "Nothing here yet."}
            </p>
            <p className="mt-2 text-sm text-ash">
              {filter === "open"
                ? "Be the first to post a brief."
                : "Try a different filter."}
            </p>
            {filter === "open" && !search && (
              <Link href="/collabs/new" className="mt-6 inline-block">
                <Button variant="primary" size="md">
                  Post a brief
                </Button>
              </Link>
            )}
          </div>
        </Reveal>
      )}
    </div>
  );
}
