"use client";

import { useState } from "react";
import { Tag } from "@/components/primitives/Tag";
import {
  Briefcase,
  GraduationCap,
  Wrench,
  Microscope,
  HeartHandshake,
  Users,
  ExternalLink,
  MapPin,
  Award,
  Layers,
} from "lucide-react";
import type { Resume, Experience, Education, ExperienceType } from "@/lib/db/resume";
import { ProfileResumeEditor } from "@/components/composite/ProfileResumeEditor";

// ---------------------------------------------------------------------------
// Shared formatting + type metadata (also imported by the editor).
// ---------------------------------------------------------------------------

/** "Jun 2024" from an ISO date string (null -> ""). */
export function formatMonthYear(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

/** "Jun 2022 - May 2027" / "Jun 2024 - Present" / single endpoint. */
export function formatRange(start: string | null, end: string | null, isCurrent: boolean): string {
  const from = formatMonthYear(start);
  const to = isCurrent ? "Present" : formatMonthYear(end);
  if (from && to) return `${from} - ${to}`;
  if (from) return from;
  if (to) return to;
  return "";
}

export const EXPERIENCE_TYPES: { id: ExperienceType; label: string; icon: typeof Briefcase }[] = [
  { id: "work", label: "Work", icon: Briefcase },
  { id: "internship", label: "Internship", icon: Layers },
  { id: "project", label: "Project", icon: Wrench },
  { id: "research", label: "Research", icon: Microscope },
  { id: "volunteer", label: "Volunteer", icon: HeartHandshake },
  { id: "leadership", label: "Leadership", icon: Users },
];

const TYPE_META: Record<ExperienceType, { label: string; icon: typeof Briefcase; className: string }> = {
  work: { label: "Work", icon: Briefcase, className: "bg-saffron/10 text-saffron-dk" },
  internship: { label: "Internship", icon: Layers, className: "bg-saffron/10 text-saffron-dk" },
  project: { label: "Project", icon: Wrench, className: "bg-moss/10 text-moss" },
  research: { label: "Research", icon: Microscope, className: "bg-bone text-ink" },
  volunteer: { label: "Volunteer", icon: HeartHandshake, className: "bg-moss/10 text-moss" },
  leadership: { label: "Leadership", icon: Users, className: "bg-bone text-ink" },
};

// ---------------------------------------------------------------------------
// Description with "see more" / "see less" toggle.
// ---------------------------------------------------------------------------

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // Treat anything reasonably long as clampable.
  const isLong = text.length > 220 || text.split("\n").length > 4;
  return (
    <div className="mt-2">
      <p className={"whitespace-pre-line text-sm leading-relaxed text-ink/90" + (!expanded && isLong ? " line-clamp-4" : "")}>
        {text}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-saffron-dk transition-colors hover:text-saffron"
        >
          {expanded ? "See less" : "See more"}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experience timeline item.
// ---------------------------------------------------------------------------

export function ExperienceItem({ item, last }: { item: Experience; last: boolean }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const range = formatRange(item.start_date, item.end_date, item.is_current);
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {/* Timeline rail */}
      <div className="flex shrink-0 flex-col items-center">
        <span className="flex size-9 items-center justify-center rounded-full border border-bone bg-cream text-ash">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        {!last ? <span className="mt-1 w-px flex-1 bg-bone" aria-hidden /> : null}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide " + meta.className}>
            {meta.label}
          </span>
          {item.is_current ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-2.5 py-0.5 text-[11px] font-medium text-moss">
              <span className="size-1.5 rounded-full bg-moss" /> Current
            </span>
          ) : null}
        </div>

        <h4 className="mt-1.5 font-serif text-lg leading-snug text-ink" style={{ letterSpacing: "-0.01em" }}>
          {item.title}
        </h4>

        {(item.organization || item.location) ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ash">
            {item.organization ? <span className="font-medium text-ink">{item.organization}</span> : null}
            {item.organization && item.location ? <span aria-hidden>&middot;</span> : null}
            {item.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                {item.location}
              </span>
            ) : null}
          </p>
        ) : null}

        {range ? <p className="mt-0.5 text-xs text-ash">{range}</p> : null}

        {item.description ? <Description text={item.description} /> : null}

        {item.skills.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {item.skills.map((s) => (
              <Tag key={s} variant="outline" className="capitalize">
                {s}
              </Tag>
            ))}
          </div>
        ) : null}

        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-saffron-dk transition-colors hover:text-saffron"
          >
            View <ExternalLink className="size-3.5" strokeWidth={1.75} />
          </a>
        ) : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Education item.
// ---------------------------------------------------------------------------

export function EducationItem({ item, last }: { item: Education; last: boolean }) {
  const range = formatRange(item.start_date, item.end_date, item.is_current);
  const degreeLine = [item.degree, item.field_of_study].filter(Boolean).join(", ");
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <div className="flex shrink-0 flex-col items-center">
        <span className="flex size-9 items-center justify-center rounded-full border border-bone bg-cream text-ash">
          <GraduationCap className="size-4" strokeWidth={1.75} />
        </span>
        {!last ? <span className="mt-1 w-px flex-1 bg-bone" aria-hidden /> : null}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <h4 className="font-serif text-lg leading-snug text-ink" style={{ letterSpacing: "-0.01em" }}>
          {item.institution}
        </h4>
        {degreeLine ? <p className="mt-0.5 text-sm font-medium text-ink">{degreeLine}</p> : null}
        {range ? <p className="mt-0.5 text-xs text-ash">{range}</p> : null}
        {item.grade ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-0.5 text-xs text-ink">
            <Award className="size-3.5 text-ash" strokeWidth={1.75} /> {item.grade}
          </p>
        ) : null}
        {item.description ? <Description text={item.description} /> : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Skills, grouped by category.
// ---------------------------------------------------------------------------

const SKILL_GROUPS: { id: import("@/lib/db/resume").SkillCategory; label: string }[] = [
  { id: "technical", label: "Technical" },
  { id: "tool", label: "Tools" },
  { id: "language", label: "Languages" },
  { id: "soft", label: "Soft skills" },
];

function SkillsView({ skills }: { skills: Resume["skills"] }) {
  return (
    <div className="space-y-5">
      {SKILL_GROUPS.map((group) => {
        const items = skills.filter((s) => s.category === group.id);
        if (items.length === 0) return null;
        return (
          <div key={group.id}>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-ash">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((s) => (
                <Tag key={s.id} variant="default" className="capitalize">
                  {s.name}
                </Tag>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section shell - matches the bg-paper border-bone rounded card style.
// ---------------------------------------------------------------------------

export function ResumeSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-bone bg-paper p-6">
      <h3 className="mb-5 flex items-center gap-2 font-serif text-lg text-ink" style={{ letterSpacing: "-0.01em" }}>
        <span className="text-ash">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component.
// ---------------------------------------------------------------------------

interface ProfileResumeProps {
  resume: Resume;
  isOwner: boolean;
}

export function ProfileResume({ resume, isOwner }: ProfileResumeProps) {
  // Owner gets the live, optimistic editor (which itself renders read-only when
  // not editing). Visitors get the purely presentational read-only view below.
  if (isOwner) {
    return <ProfileResumeEditor resume={resume} />;
  }

  const { experience, education, skills } = resume;
  const hasAny = experience.length > 0 || education.length > 0 || skills.length > 0;

  // Visitor view: nothing renders for empty sections, and the whole block is
  // hidden when there is no content at all.
  if (!hasAny) return null;

  return (
    <div className="space-y-5">
      {experience.length > 0 ? (
        <ResumeSection title="Experience" icon={<Briefcase className="size-4" strokeWidth={1.75} />}>
          <ol>
            {experience.map((e, i) => (
              <ExperienceItem key={e.id} item={e} last={i === experience.length - 1} />
            ))}
          </ol>
        </ResumeSection>
      ) : null}

      {education.length > 0 ? (
        <ResumeSection title="Education" icon={<GraduationCap className="size-4" strokeWidth={1.75} />}>
          <ol>
            {education.map((e, i) => (
              <EducationItem key={e.id} item={e} last={i === education.length - 1} />
            ))}
          </ol>
        </ResumeSection>
      ) : null}

      {skills.length > 0 ? (
        <ResumeSection title="Skills" icon={<Wrench className="size-4" strokeWidth={1.75} />}>
          <SkillsView skills={skills} />
        </ResumeSection>
      ) : null}
    </div>
  );
}
