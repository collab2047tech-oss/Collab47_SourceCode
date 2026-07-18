import Link from "next/link";
import {
  MapPin,
  Globe,
  Trophy,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { Tag } from "@/components/primitives/Tag";
import { cn } from "@/lib/cn";
import type { EventKind, EventMode, EventRow } from "@/lib/db/events";

// ---------------------------------------------------------------------------
// Kind + mode display config
// ---------------------------------------------------------------------------

const KIND_META: Record<EventKind, { label: string; badge: string }> = {
  hackathon:  { label: "Hackathon",  badge: "bg-saffron/10 text-saffron-dk" },
  competition:{ label: "Competition",badge: "bg-ember/10 text-ember" },
  workshop:   { label: "Workshop",   badge: "bg-moss/10 text-moss" },
  conference: { label: "Conference", badge: "bg-ink/8 text-ink" },
  fest:       { label: "Fest",       badge: "bg-gold/15 text-[#9A6A00]" },
  talk:       { label: "Talk",       badge: "bg-saffron/10 text-saffron-dk" },
  other:      { label: "Event",      badge: "bg-bone text-ink" },
};

const MODE_LABEL: Record<EventMode, string> = {
  online: "Online",
  in_person: "In person",
  hybrid: "Hybrid",
};

function kindMeta(kind: string) {
  return KIND_META[kind as EventKind] ?? KIND_META.other;
}

// ---------------------------------------------------------------------------
// Date helpers (no external lib; en-IN formatting per the design system)
// ---------------------------------------------------------------------------

/** e.g. "Sat, 12 Jul - 9:00 AM" */
function formatStart(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} - ${time}`;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Registration-deadline state for the closing pill.
 *  - closed: deadline has passed
 *  - today:  closes today
 *  - soon/open: "Closes in N days"
 */
function deadlineState(iso: string | null): {
  label: string;
  closed: boolean;
} | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff <= 0) return { label: "Registration closed", closed: true };
  const days = Math.ceil(diff / DAY_MS);
  if (days <= 1) return { label: "Closes today", closed: false };
  return { label: `Closes in ${days} days`, closed: false };
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function EventCard({ event, index = 0 }: { event: EventRow; index?: number }) {
  const meta = kindMeta(event.kind);
  const start = formatStart(event.starts_at);
  const deadline = deadlineState(event.registration_deadline);
  const detailHref = `/events/${event.id}`;
  const hasReg = Boolean(event.registration_url);

  // Stable gradient for the no-image header (varies by kind + index so the grid
  // isn't a wall of identical headers). Mirrors InShortsFeed's no-image header.
  const gradients = [
    "linear-gradient(135deg,#12100E_0%,#A34802_100%)",
    "linear-gradient(135deg,#A34802_0%,#B95402_100%)",
    "linear-gradient(135deg,#03265E_0%,#047857_100%)",
    "linear-gradient(135deg,#12100E_0%,#6B6559_100%)",
  ];
  const gradient = gradients[index % gradients.length];

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-bone bg-paper transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron/40 hover:shadow-sm">
      {/* Header: real image when present, gradient + kind otherwise. The whole
          header is a link to the detail page. */}
      <Link href={detailHref} className="block" aria-label={event.title}>
        {event.image_url ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/60 to-transparent" />
            <span className={cn("absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide", meta.badge)}>
              {meta.label}
            </span>
          </div>
        ) : (
          <div
            className="flex aspect-[16/9] w-full items-end justify-between p-4"
            style={{ backgroundImage: gradient.replace(/_/g, " ") }}
          >
            <span className="inline-flex items-center gap-1.5 text-cream/90">
              <CalendarDays className="size-4" />
              <span className="text-xs font-medium uppercase tracking-widest">
                {meta.label}
              </span>
            </span>
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        {/* Kind badge inline when there is a real image header (the header badge
            sits on the photo); always show a deadline pill row below. */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide", meta.badge)}>
            {meta.label}
          </span>
          {deadline ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                deadline.closed
                  ? "bg-bone text-ash"
                  : "bg-moss/10 text-moss"
              )}
            >
              {deadline.label}
            </span>
          ) : null}
        </div>

        <Link href={detailHref} className="mt-3 block">
          <h2 className="font-serif text-lg font-medium leading-snug text-ink transition-colors group-hover:text-saffron line-clamp-2">
            {event.title}
          </h2>
        </Link>

        {event.organizer ? (
          <p className="mt-1.5 truncate text-sm text-ash">by {event.organizer}</p>
        ) : null}

        {/* Mode + location + start time */}
        <div className="mt-3 flex flex-col gap-1.5 text-xs text-ash">
          <span className="flex items-center gap-1.5">
            {event.mode === "online" ? (
              <Globe className="size-3.5 shrink-0" />
            ) : (
              <MapPin className="size-3.5 shrink-0" />
            )}
            <span className="truncate">
              {MODE_LABEL[event.mode]}
              {event.location ? ` - ${event.location}` : ""}
            </span>
          </span>
          {start ? (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              <span className="truncate">{start}</span>
            </span>
          ) : null}
          {event.prize ? (
            <span className="flex items-center gap-1.5 text-[#9A6A00]">
              <Trophy className="size-3.5 shrink-0" />
              <span className="truncate">{event.prize}</span>
            </span>
          ) : null}
        </div>

        {/* Tags */}
        {event.tags && event.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.tags.slice(0, 4).map((t) => (
              <Tag key={t} variant="saffron" className="text-[11px]">
                #{t}
              </Tag>
            ))}
          </div>
        ) : null}

        {/* Register CTA: external registration when present, else detail page. */}
        <div className="mt-auto pt-4">
          {hasReg ? (
            <a
              href={event.registration_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-saffron px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-[0.98]"
            >
              Register <ArrowUpRight className="size-4" />
            </a>
          ) : (
            <Link
              href={detailHref}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
            >
              View details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
