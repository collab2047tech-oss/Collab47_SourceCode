import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Globe,
  MapPin,
  Trophy,
} from "lucide-react";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/motion/Reveal";
import { ShareButton } from "@/components/composite/ShareButton";
import {
  getEventById,
  type EventKind,
  type EventMode,
} from "@/lib/db/events";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<EventKind, string> = {
  hackathon: "Hackathon",
  competition: "Competition",
  workshop: "Workshop",
  conference: "Conference",
  fest: "Fest",
  talk: "Talk",
  other: "Event",
};

const MODE_LABEL: Record<EventMode, string> = {
  online: "Online",
  in_person: "In person",
  hybrid: "Hybrid",
};

/** e.g. "Sat, 12 Jul 2026 - 9:00 AM" */
function formatFull(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} - ${time}`;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function deadlineState(iso: string | null): { label: string; closed: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return { label: "Registration closed", closed: true };
  const days = Math.ceil(diff / DAY_MS);
  if (days <= 1) return { label: "Registration closes today", closed: false };
  return { label: `Registration closes in ${days} days`, closed: false };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) {
    return (
      <div className="max-w-3xl">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-ash transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to Events
        </Link>
        <h1 className="mt-8 font-serif text-3xl text-ink sm:text-4xl">
          Event{" "}
          <span className="italic text-saffron">not found.</span>
        </h1>
        <p className="mt-3 text-body-sm text-ash">
          This event may have been removed, or the link is incorrect.
        </p>
        <Link href="/events" className="mt-6 inline-block">
          <Button variant="primary" size="md">
            Browse events
          </Button>
        </Link>
      </div>
    );
  }

  const start = formatFull(event.starts_at);
  const end = formatFull(event.ends_at);
  const regDeadline = formatFull(event.registration_deadline);
  const deadline = deadlineState(event.registration_deadline);
  const hasReg = Boolean(event.registration_url);

  return (
    <div className="max-w-3xl pb-20">
      <Reveal>
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-ash transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to Events
        </Link>
      </Reveal>

      {/* Cover */}
      {event.image_url ? (
        <Reveal delay={0.05}>
          <div className="mt-6 overflow-hidden rounded-xl border border-bone bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url}
              alt=""
              className="aspect-[16/7] w-full object-cover"
              decoding="async"
            />
          </div>
        </Reveal>
      ) : null}

      <Reveal delay={0.08}>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Tag variant="saffron">{KIND_LABEL[event.kind]}</Tag>
          {deadline ? (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                deadline.closed ? "bg-bone text-ash" : "bg-moss/10 text-moss"
              }`}
            >
              {deadline.label}
            </span>
          ) : null}
        </div>

        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
          {event.title}
        </h1>
        {event.organizer ? (
          <p className="mt-3 text-body-sm text-ash">Organized by {event.organizer}</p>
        ) : null}
      </Reveal>

      {/* Author + share */}
      <Reveal delay={0.1}>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {event.author ? (
            <Link
              href={`/u/${event.author.handle}`}
              className="flex items-center gap-3"
            >
              <Avatar
                name={event.author.name}
                src={event.author.avatar_url ?? undefined}
                size="sm"
              />
              <span className="text-sm text-ash">
                Posted by{" "}
                <span className="font-medium text-ink">@{event.author.handle}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          <ShareButton
            path={`/events/${event.id}`}
            shareTitle={event.title}
            shareText={`${KIND_LABEL[event.kind]} on Collab47`}
          />
        </div>
      </Reveal>

      {/* Metadata grid */}
      <Reveal delay={0.13}>
        <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 border-y border-bone py-5 text-sm sm:grid-cols-2">
          <MetaRow
            icon={event.mode === "online" ? <Globe className="size-4" /> : <MapPin className="size-4" />}
            label="Mode"
            value={`${MODE_LABEL[event.mode]}${event.location ? ` · ${event.location}` : ""}`}
          />
          {start ? (
            <MetaRow icon={<CalendarDays className="size-4" />} label="Starts" value={start} />
          ) : null}
          {end ? (
            <MetaRow icon={<Clock className="size-4" />} label="Ends" value={end} />
          ) : null}
          {regDeadline ? (
            <MetaRow icon={<Clock className="size-4" />} label="Registration deadline" value={regDeadline} />
          ) : null}
          {event.prize ? (
            <MetaRow icon={<Trophy className="size-4" />} label="Prize / perks" value={event.prize} />
          ) : null}
        </div>
      </Reveal>

      {/* Description */}
      {event.description ? (
        <Reveal delay={0.16}>
          <section className="mt-8">
            <h2 className="text-caption text-ash">About this event</h2>
            <p className="mt-3 whitespace-pre-line break-words text-body leading-relaxed text-ink">
              {event.description}
            </p>
          </section>
        </Reveal>
      ) : null}

      {/* Tags */}
      {event.tags && event.tags.length > 0 ? (
        <Reveal delay={0.18}>
          <div className="mt-8 flex flex-wrap gap-2">
            {event.tags.map((t) => (
              <Tag key={t} variant="saffron" className="text-xs">
                #{t}
              </Tag>
            ))}
          </div>
        </Reveal>
      ) : null}

      {/* Register CTA */}
      <Reveal delay={0.2}>
        <div className="mt-10">
          {hasReg ? (
            <a
              href={event.registration_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-saffron px-7 py-4 text-lg font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-[0.98]"
            >
              Register <ArrowUpRight className="size-5" />
            </a>
          ) : (
            <p className="text-sm text-ash">
              No registration link was provided. Reach out to the organizer for
              details.
            </p>
          )}
        </div>
      </Reveal>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-ink">
      <span className="mt-0.5 shrink-0 text-ash">{icon}</span>
      <div className="min-w-0">
        <p className="text-caption text-ash">{label}</p>
        <p className="text-sm text-ink">{value}</p>
      </div>
    </div>
  );
}
