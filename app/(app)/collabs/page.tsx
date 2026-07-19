import Link from "next/link";
import { listProjects, type ProjectListFilter } from "@/lib/db/projects";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Users, Clock, CalendarRange, Calendar, Search } from "lucide-react";

const FILTERS: { key: ProjectListFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "forming", label: "Forming" },
  { key: "delivered", label: "Delivered" },
  { key: "all", label: "All" },
];

const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "web", label: "Web" },
  { slug: "mobile", label: "Mobile" },
  { slug: "ml", label: "ML / AI" },
  { slug: "research", label: "Research" },
  { slug: "design", label: "Design" },
  { slug: "hardware", label: "Hardware" },
  { slug: "social", label: "Social impact" },
  { slug: "other", label: "Other" },
];
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

const COMMITMENTS: { key: string; label: string }[] = [
  { key: "light", label: "< 5 hrs" },
  { key: "part", label: "5-10 hrs" },
  { key: "significant", label: "10-20 hrs" },
  { key: "heavy", label: "20+ hrs" },
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

function commitmentLabel(h: number | null): string | null {
  if (h == null) return null;
  if (h < 5) return "< 5 hrs/week";
  if (h < 10) return "5-10 hrs/week";
  if (h < 20) return "10-20 hrs/week";
  return "20+ hrs/week";
}

interface Role {
  title: string;
  skills: string[];
  count: number;
}

export default async function CollabsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; category?: string; commitment?: string }>;
}) {
  const sp = await searchParams;
  const filter: ProjectListFilter = FILTERS.some((f) => f.key === sp.filter)
    ? (sp.filter as ProjectListFilter)
    : "open";
  const search = (sp.q ?? "").trim();
  const category = CATEGORIES.some((c) => c.slug === sp.category) ? (sp.category as string) : "";
  const commitment = COMMITMENTS.some((c) => c.key === sp.commitment) ? (sp.commitment as string) : "";

  const projects = await listProjects({
    filter,
    search,
    category: category || undefined,
    commitment: commitment || undefined,
    limit: 24,
  });

  const buildHref = (
    next: Partial<{ filter: string; q: string; category: string; commitment: string }>,
  ) => {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const q = next.q ?? search;
    const cat = next.category ?? category;
    const com = next.commitment ?? commitment;
    if (f && f !== "open") params.set("filter", f);
    if (q) params.set("q", q);
    if (cat) params.set("category", cat);
    if (com) params.set("commitment", com);
    const qs = params.toString();
    return qs ? `/collabs?${qs}` : "/collabs";
  };

  const hasActiveNarrowing = !!search || !!category || !!commitment || filter !== "open";

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <Reveal>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <p className="text-caption text-ash">Collab Projects</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-display-md">
              Briefs from industry.{" "}
              <span className="italic text-saffron">Teams from campus.</span>
            </h1>
          </div>
          <Link href="/collabs/new" className="shrink-0 sm:mt-2">
            <Button variant="primary" size="md" className="w-full sm:w-auto">
              Post a brief
            </Button>
          </Link>
        </div>
      </Reveal>

      {/* Status filters + search */}
      <Reveal delay={0.05}>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ filter: f.key })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 ${
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

          <form action="/collabs" method="get" className="relative w-full sm:w-auto">
            {filter !== "open" && <input type="hidden" name="filter" value={filter} />}
            {category && <input type="hidden" name="category" value={category} />}
            {commitment && <input type="hidden" name="commitment" value={commitment} />}
            <label htmlFor="collab-search" className="sr-only">
              Search briefs
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ash" />
            <input
              id="collab-search"
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search briefs..."
              className="h-11 w-full rounded-full border border-bone bg-paper pl-9 pr-4 text-sm text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20 sm:w-64"
            />
          </form>
        </div>
      </Reveal>

      {/* Category + commitment filters */}
      <Reveal delay={0.07}>
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-caption text-ash">Category</span>
            <Link
              href={buildHref({ category: "" })}
              aria-current={!category ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 ${
                !category
                  ? "border-saffron bg-saffron/10 text-saffron-dk"
                  : "border-bone bg-paper text-ash hover:border-ink/30 hover:text-ink"
              }`}
            >
              All
            </Link>
            {CATEGORIES.map((c) => {
              const active = category === c.slug;
              return (
                <Link
                  key={c.slug}
                  href={buildHref({ category: active ? "" : c.slug })}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 ${
                    active
                      ? "border-saffron bg-saffron/10 text-saffron-dk"
                      : "border-bone bg-paper text-ash hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-caption text-ash">Commitment</span>
            <Link
              href={buildHref({ commitment: "" })}
              aria-current={!commitment ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 ${
                !commitment
                  ? "border-saffron bg-saffron/10 text-saffron-dk"
                  : "border-bone bg-paper text-ash hover:border-ink/30 hover:text-ink"
              }`}
            >
              Any
            </Link>
            {COMMITMENTS.map((c) => {
              const active = commitment === c.key;
              return (
                <Link
                  key={c.key}
                  href={buildHref({ commitment: active ? "" : c.key })}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 ${
                    active
                      ? "border-saffron bg-saffron/10 text-saffron-dk"
                      : "border-bone bg-paper text-ash hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Result count */}
      {projects.length > 0 && (
        <Reveal delay={0.08}>
          <div className="mt-8 flex items-center gap-3">
            <p className="text-caption shrink-0 tabular-nums">
              {projects.length} {projects.length === 1 ? "brief" : "briefs"}
              {filter !== "all" ? ` · ${FILTERS.find((f) => f.key === filter)?.label}` : ""}
            </p>
            <span className="h-px flex-1 bg-bone" />
          </div>
        </Reveal>
      )}

      {/* Projects grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {projects.map((project, i) => {
          const p = project as {
            id: string;
            short_id: string;
            title: string;
            brief: string;
            deadline: string;
            status: string;
            category: string | null;
            commitment_hours: number | null;
            duration: string | null;
            roles: Role[] | null;
            member_count: number;
            author: { id: string; handle: string; name: string; avatar_url: string | null };
          };
          const roles = Array.isArray(p.roles) ? p.roles : [];
          const catLabel = p.category ? CATEGORY_LABELS[p.category] ?? "Other" : null;
          const commit = commitmentLabel(p.commitment_hours);
          const roleTitles = roles.map((r) => r.title).filter(Boolean);
          return (
            <Reveal key={p.id} delay={i * 0.05}>
              <Link
                href={`/c/${p.short_id}`}
                className="group flex h-full flex-col rounded-lg border border-bone bg-paper p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 text-base font-semibold text-ink transition-colors group-hover:text-saffron">
                    {p.title}
                  </h2>
                  <Tag variant={statusVariant(p.status)} className="shrink-0">
                    {statusLabel(p.status)}
                  </Tag>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {catLabel && (
                    <Tag variant="outline" className="text-[11px]">
                      {catLabel}
                    </Tag>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Avatar
                      name={p.author.name}
                      src={p.author.avatar_url ?? undefined}
                      size="xs"
                    />
                    <span className="text-xs text-ash">@{p.author.handle}</span>
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-ash">{p.brief}</p>

                <div className="mt-auto space-y-1.5 pt-4 text-xs text-ash">
                  {roleTitles.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {roleTitles.slice(0, 2).join(", ")}
                        {roleTitles.length > 2 ? ` +${roleTitles.length - 2}` : ""}
                      </span>
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {commit && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" /> {commit}
                      </span>
                    )}
                    {p.duration && (
                      <span className="flex items-center gap-1.5">
                        <CalendarRange className="size-3.5" /> {p.duration}
                      </span>
                    )}
                    {/* Legacy fallback: no commitment/duration -> show the deadline
                        so the card is never a bare footer. */}
                    {!commit && !p.duration && roleTitles.length === 0 && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        Due{" "}
                        {new Date(p.deadline).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>

      {projects.length === 0 && (
        <Reveal delay={0.1}>
          <div className="mt-16 text-center">
            {hasActiveNarrowing ? (
              <>
                <p className="text-body text-ash">
                  {search ? "No briefs match your search." : "No briefs match these filters."}
                </p>
                <p className="mt-2 text-sm text-ash">Try widening or clearing them.</p>
                <Link href="/collabs" className="mt-6 inline-block">
                  <Button variant="secondary" size="md">
                    Clear filters
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-body text-ash">No open briefs yet.</p>
                <p className="mt-2 text-sm text-ash">
                  Be the first to post one - describe the work, the roles you need, and
                  let students apply.
                </p>
                <Link href="/collabs/new" className="mt-6 inline-block">
                  <Button variant="primary" size="md">
                    Post the first brief
                  </Button>
                </Link>
              </>
            )}
          </div>
        </Reveal>
      )}
    </div>
  );
}
