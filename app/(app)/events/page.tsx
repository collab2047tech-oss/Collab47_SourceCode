import Link from "next/link";
import { listEvents, type EventListFilter, type EventKind } from "@/lib/db/events";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { EventCard } from "@/components/composite/EventCard";

export const dynamic = "force-dynamic";

const KIND_CHIPS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "hackathon", label: "Hackathons" },
  { key: "competition", label: "Competitions" },
  { key: "workshop", label: "Workshops" },
  { key: "conference", label: "Conferences" },
  { key: "fest", label: "Fests" },
  { key: "talk", label: "Talks" },
];

const TIME_TABS: { key: EventListFilter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; filter?: string }>;
}) {
  const sp = await searchParams;

  const kind = KIND_CHIPS.some((k) => k.key === sp.kind) ? (sp.kind as string) : "all";
  const filter: EventListFilter = TIME_TABS.some((t) => t.key === sp.filter)
    ? (sp.filter as EventListFilter)
    : "upcoming";

  const events = await listEvents({
    filter,
    kind: kind === "all" ? undefined : (kind as EventKind),
    limit: 36,
  });

  const buildHref = (next: Partial<{ kind: string; filter: string }>) => {
    const params = new URLSearchParams();
    const k = next.kind ?? kind;
    const f = next.filter ?? filter;
    if (k && k !== "all") params.set("kind", k);
    if (f && f !== "upcoming") params.set("filter", f);
    const qs = params.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  return (
    <div className="max-w-5xl">
      {/* Hero header */}
      <Reveal>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <p className="text-caption text-ash">Events & Competitions</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-display-md">
              What&apos;s on.{" "}
              <span className="italic text-saffron">Across the ecosystem.</span>
            </h1>
            <p className="mt-3 max-w-xl text-body-sm text-ash">
              Hackathons, competitions, workshops, conferences, and college
              fests, posted by companies, colleges, and students. Find your next
              one or share your own.
            </p>
          </div>
          <Link href="/events/new" className="shrink-0 sm:mt-2">
            <Button variant="primary" size="md" className="w-full sm:w-auto">
              Post an event
            </Button>
          </Link>
        </div>
      </Reveal>

      {/* Filters */}
      <Reveal delay={0.05}>
        <div className="mt-8 flex flex-col gap-4">
          {/* Kind chips */}
          <div className="flex flex-wrap gap-2">
            {KIND_CHIPS.map((c) => {
              const active = c.key === kind;
              return (
                <Link
                  key={c.key}
                  href={buildHref({ kind: c.key })}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-all active:scale-95 ${
                    active
                      ? "border-ink bg-ink text-cream"
                      : "border-bone bg-paper text-ash hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>

          {/* Upcoming | Past toggle */}
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-bone bg-paper p-1">
            {TIME_TABS.map((t) => {
              const active = t.key === filter;
              return (
                <Link
                  key={t.key}
                  href={buildHref({ filter: t.key })}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-saffron text-cream"
                      : "text-ash hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Result count */}
      {events.length > 0 ? (
        <Reveal delay={0.08}>
          <div className="mt-8 flex items-center gap-3">
            <p className="text-caption shrink-0 tabular-nums">
              {events.length} {events.length === 1 ? "event" : "events"}
              {filter === "past" ? " · Past" : ""}
            </p>
            <span className="h-px flex-1 bg-bone" />
          </div>
        </Reveal>
      ) : null}

      {/* Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event, i) => (
          <Reveal key={event.id} delay={Math.min(i, 6) * 0.04}>
            <EventCard event={event} index={i} />
          </Reveal>
        ))}
      </div>

      {/* Empty state */}
      {events.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="mt-16 text-center">
            <p className="text-body text-ash">
              {filter === "past"
                ? "No past events to show here yet."
                : kind === "all"
                ? "No upcoming events yet."
                : "No upcoming events in this category yet."}
            </p>
            <p className="mt-2 text-sm text-ash">
              {filter === "past"
                ? "Upcoming events will move here once they have started."
                : "Be the first to post one."}
            </p>
            {filter !== "past" ? (
              <Link href="/events/new" className="mt-6 inline-block">
                <Button variant="primary" size="md">
                  Post an event
                </Button>
              </Link>
            ) : null}
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
