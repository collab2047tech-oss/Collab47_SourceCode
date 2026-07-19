"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Plus, X, Check, Users, Clock, CalendarRange } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { cn } from "@/lib/cn";
import { createProjectAction } from "./actions";
import type { CreateProjectField } from "@/lib/db/projects";

// ---------------------------------------------------------------------------
// Static option data (kept in sync with lib/db/projects.ts + the index filters)
// ---------------------------------------------------------------------------

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

// Commitment chips map to concrete hours/week (documented: the DB stores the int,
// the index filters by band). "<5"->4, "5-10"->8, "10-20"->15, "20+"->25.
const COMMITMENTS: { label: string; hours: number }[] = [
  { label: "< 5 hrs / week", hours: 4 },
  { label: "5-10 hrs / week", hours: 8 },
  { label: "10-20 hrs / week", hours: 15 },
  { label: "20+ hrs / week", hours: 25 },
];

const DURATIONS = ["2 weeks", "1 month", "3 months", "6 months+"];

const TITLE_MIN = 8;
const BRIEF_MIN = 140;

type StepKey = "basics" | "work" | "team" | "preview";
const STEPS: StepKey[] = ["basics", "work", "team", "preview"];

let roleSeq = 0;

interface RoleDraft {
  id: number;
  title: string;
  skills: string[];
  count: number;
  skillInput: string;
}

interface WizardData {
  title: string;
  category: string;
  brief: string;
  deliverable: string;
  roles: RoleDraft[];
  commitment: number | null;
  duration: string;
}

function newRole(): RoleDraft {
  return { id: ++roleSeq, title: "", skills: [], count: 1, skillInput: "" };
}

/** First sentence (or a clamp) of the brief - the honest hero/card one-liner. */
function leadLine(brief: string): string {
  const t = brief.trim();
  if (!t) return "";
  const stop = t.search(/[.!?]\s/);
  if (stop > 0 && stop < 180) return t.slice(0, stop + 1);
  return t.length > 160 ? `${t.slice(0, 160).trimEnd()}...` : t;
}

// Map a server field error back to the step that owns it.
const FIELD_STEP: Record<CreateProjectField, StepKey> = {
  title: "basics",
  brief: "work",
  deliverable: "work",
  roles: "team",
};

export default function NewProjectPage() {
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const submittedRef = useRef(false);

  const [data, setData] = useState<WizardData>({
    title: "",
    category: "",
    brief: "",
    deliverable: "",
    roles: [newRole()],
    commitment: null,
    duration: "",
  });

  // One updater so every change flips the dirty flag for the unsaved-changes guard.
  function patch(next: Partial<WizardData>) {
    setDirty(true);
    setData((d) => ({ ...d, ...next }));
  }

  // Unsaved-changes guard: browser close / refresh / tab nav.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !submittedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const currentKey = STEPS[index];
  const total = STEPS.length;

  const trimmedTitle = data.title.trim();
  const trimmedBrief = data.brief.trim();
  const validRoles = data.roles.filter((r) => r.title.trim().length > 0);

  // Per-step gate.
  const canContinue = (() => {
    switch (currentKey) {
      case "basics":
        return trimmedTitle.length >= TITLE_MIN && data.category !== "";
      case "work":
        return trimmedBrief.length >= BRIEF_MIN && data.deliverable.trim().length > 0;
      case "team":
        return validRoles.length >= 1;
      default:
        return true;
    }
  })();

  // Same aria-live gate-hint mechanism onboarding uses: never a silently disabled
  // Continue - always name exactly what is still missing.
  const gateHint: string | null = (() => {
    if (canContinue) return null;
    switch (currentKey) {
      case "basics":
        if (trimmedTitle.length < TITLE_MIN)
          return `Title needs ${TITLE_MIN - trimmedTitle.length} more character${
            TITLE_MIN - trimmedTitle.length === 1 ? "" : "s"
          }.`;
        if (!data.category) return "Pick a category to continue.";
        return "Add a title and category to continue.";
      case "work":
        if (trimmedBrief.length < BRIEF_MIN)
          return `Brief needs ${BRIEF_MIN - trimmedBrief.length} more character${
            BRIEF_MIN - trimmedBrief.length === 1 ? "" : "s"
          } - describe the problem and who you need.`;
        if (!data.deliverable.trim()) return "Describe what the team will deliver.";
        return "Fill in the brief and deliverable to continue.";
      case "team":
        return "Add at least one role with a title to continue.";
      default:
        return null;
    }
  })();

  function next() {
    if (index < total - 1) setIndex((i) => i + 1);
  }
  function back() {
    if (index > 0) setIndex((i) => i - 1);
  }

  function handleBackToCollabs(e: React.MouseEvent) {
    if (dirty && !submittedRef.current) {
      if (!window.confirm("Leave now? Your draft brief will be lost.")) {
        e.preventDefault();
      }
    }
  }

  // --- Roles builder ---
  function addRole() {
    patch({ roles: [...data.roles, newRole()] });
  }
  function removeRole(id: number) {
    patch({ roles: data.roles.length > 1 ? data.roles.filter((r) => r.id !== id) : data.roles });
  }
  function updateRole(id: number, next: Partial<RoleDraft>) {
    patch({ roles: data.roles.map((r) => (r.id === id ? { ...r, ...next } : r)) });
  }
  function commitSkill(id: number, raw: string) {
    const skill = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!skill) return;
    const role = data.roles.find((r) => r.id === id);
    if (!role) return;
    if (
      role.skills.some((s) => s.toLowerCase() === skill.toLowerCase()) ||
      role.skills.length >= 12
    ) {
      updateRole(id, { skillInput: "" });
      return;
    }
    updateRole(id, { skills: [...role.skills, skill], skillInput: "" });
  }
  function removeSkill(id: number, skill: string) {
    const role = data.roles.find((r) => r.id === id);
    if (!role) return;
    updateRole(id, { skills: role.skills.filter((s) => s !== skill) });
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await createProjectAction({
        title: trimmedTitle,
        brief: trimmedBrief,
        deliverable: data.deliverable.trim(),
        category: data.category || null,
        roles: validRoles.map((r) => ({
          title: r.title.trim(),
          skills: r.skills,
          count: r.count,
        })),
        commitmentHours: data.commitment,
        duration: data.duration.trim() || null,
      });
      if (result?.error) {
        setError(result.error);
        if (result.field && FIELD_STEP[result.field]) {
          setIndex(STEPS.indexOf(FIELD_STEP[result.field]));
        }
      } else {
        // Success -> the action redirects; suppress the unsaved-changes prompt.
        submittedRef.current = true;
      }
    });
  }

  const briefLeft = BRIEF_MIN - trimmedBrief.length;
  const categoryLabel = CATEGORIES.find((c) => c.slug === data.category)?.label ?? null;
  const commitmentLabel = COMMITMENTS.find((c) => c.hours === data.commitment)?.label ?? null;
  const previewRoles = useMemo(
    () => data.roles.filter((r) => r.title.trim().length > 0),
    [data.roles],
  );

  const progressPct = ((index + 1) / total) * 100;

  return (
    <div className="max-w-2xl">
      <Link
        href="/collabs"
        onClick={handleBackToCollabs}
        className="inline-flex items-center gap-2 rounded-md text-sm text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
      >
        <ArrowLeft className="size-4" /> Back to Collabs
      </Link>

      {/* Header + progress */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-caption text-ash">Post a brief</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-h1">
            {currentKey === "basics" && (
              <>
                The <span className="italic text-saffron">basics.</span>
              </>
            )}
            {currentKey === "work" && (
              <>
                The <span className="italic text-saffron">work.</span>
              </>
            )}
            {currentKey === "team" && (
              <>
                Your <span className="italic text-saffron">team.</span>
              </>
            )}
            {currentKey === "preview" && (
              <>
                Ready to <span className="italic text-saffron">publish.</span>
              </>
            )}
          </h1>
        </div>
        <span className="shrink-0 text-caption text-ash">
          Step {index + 1} of {total}
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-bone" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-saffron"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="mt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentKey}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* ---------- Step 1: Basics ---------- */}
            {currentKey === "basics" && (
              <div className="space-y-8">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="title" className="text-caption text-ink">
                      Project title
                    </label>
                    <span
                      className={cn(
                        "text-caption tabular-nums",
                        trimmedTitle.length >= TITLE_MIN ? "text-moss" : "text-ash",
                      )}
                    >
                      {trimmedTitle.length >= TITLE_MIN ? (
                        <Check className="inline size-3.5" aria-hidden="true" />
                      ) : (
                        `${trimmedTitle.length}/${TITLE_MIN}`
                      )}
                    </span>
                  </div>
                  <input
                    id="title"
                    value={data.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    maxLength={120}
                    placeholder="e.g. Campus food-delivery app for late-night orders"
                    autoFocus
                    className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-lg text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                  />
                  <p className="text-xs text-ash">
                    Be specific. A clear title is the first thing applicants read.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-caption text-ink">Category</label>
                  <div className="flex flex-wrap gap-2.5">
                    {CATEGORIES.map((c) => {
                      const active = data.category === c.slug;
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          aria-pressed={active}
                          onClick={() => patch({ category: c.slug })}
                          className={cn(
                            "min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40",
                            active
                              ? "border-saffron bg-saffron text-cream shadow-sm shadow-saffron/25"
                              : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk",
                          )}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ---------- Step 2: The work ---------- */}
            {currentKey === "work" && (
              <div className="space-y-8">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="brief" className="text-caption text-ink">
                      The brief
                    </label>
                    <span
                      className={cn(
                        "text-caption tabular-nums",
                        trimmedBrief.length >= BRIEF_MIN ? "text-moss" : "text-ash",
                      )}
                    >
                      {trimmedBrief.length >= BRIEF_MIN
                        ? `${trimmedBrief.length} chars`
                        : `${trimmedBrief.length}/${BRIEF_MIN}`}
                    </span>
                  </div>
                  <textarea
                    id="brief"
                    value={data.brief}
                    onChange={(e) => patch({ brief: e.target.value })}
                    rows={6}
                    maxLength={4000}
                    placeholder="What problem are you solving? What does the work involve, and who are you looking for? The more concrete, the better the applicants."
                    autoFocus
                    className="w-full resize-none rounded-lg border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                  />
                  <p className="text-xs text-ash">
                    {briefLeft > 0
                      ? `A real brief runs a few sentences - about ${briefLeft} more to go.`
                      : "The first line becomes the one-liner on your card and page."}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="deliverable" className="text-caption text-ink">
                    Deliverable
                  </label>
                  <textarea
                    id="deliverable"
                    value={data.deliverable}
                    onChange={(e) => patch({ deliverable: e.target.value })}
                    rows={2}
                    maxLength={400}
                    placeholder="What will the team ship? e.g. an open-source repo + a short case study"
                    className="w-full resize-none rounded-lg border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                  />
                </div>
              </div>
            )}

            {/* ---------- Step 3: Team ---------- */}
            {currentKey === "team" && (
              <div className="space-y-9">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-caption text-ink">Roles needed</label>
                    <span className="text-caption text-ash">
                      {validRoles.length} role{validRoles.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {data.roles.map((role, i) => (
                      <div
                        key={role.id}
                        className="rounded-lg border border-bone bg-paper p-4"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            value={role.title}
                            onChange={(e) => updateRole(role.id, { title: e.target.value })}
                            maxLength={80}
                            placeholder="Role title, e.g. Frontend developer"
                            aria-label={`Role ${i + 1} title`}
                            className="h-12 flex-1 rounded-md border border-ink/15 bg-paper px-3 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                          />
                          {data.roles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRole(role.id)}
                              aria-label={`Remove role ${i + 1}`}
                              className="flex size-12 shrink-0 items-center justify-center rounded-md text-ash transition-colors hover:bg-bone hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
                            >
                              <X className="size-4" />
                            </button>
                          )}
                        </div>

                        {/* Skills chips */}
                        <div className="mt-3">
                          {role.skills.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {role.skills.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => removeSkill(role.id, s)}
                                  aria-label={`Remove skill ${s}`}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-saffron/10 px-3 py-1.5 text-xs font-medium text-saffron-dk transition-colors hover:bg-saffron/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                                >
                                  {s}
                                  <X className="size-3" />
                                </button>
                              ))}
                            </div>
                          )}
                          <input
                            value={role.skillInput}
                            onChange={(e) => updateRole(role.id, { skillInput: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                commitSkill(role.id, role.skillInput);
                              } else if (
                                e.key === "Backspace" &&
                                !role.skillInput &&
                                role.skills.length > 0
                              ) {
                                removeSkill(role.id, role.skills[role.skills.length - 1]);
                              }
                            }}
                            onBlur={() => role.skillInput && commitSkill(role.id, role.skillInput)}
                            maxLength={40}
                            placeholder="Add skills - type and press Enter (e.g. React, TypeScript)"
                            aria-label={`Skills for role ${i + 1}`}
                            className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                          />
                        </div>

                        {/* Count */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-ash">How many?</span>
                          {[1, 2, 3].map((n) => {
                            const active = role.count === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                aria-pressed={active}
                                onClick={() => updateRole(role.id, { count: n })}
                                className={cn(
                                  "flex size-9 items-center justify-center rounded-md border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40",
                                  active
                                    ? "border-saffron bg-saffron text-cream"
                                    : "border-bone bg-paper text-ink hover:border-saffron",
                                )}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addRole}
                    className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-dashed border-ink/25 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-saffron hover:text-saffron-dk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                  >
                    <Plus className="size-4" /> Add another role
                  </button>
                </div>

                {/* Commitment */}
                <div className="flex flex-col gap-3">
                  <label className="text-caption text-ink">
                    Weekly commitment <span className="text-ash">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {COMMITMENTS.map((c) => {
                      const active = data.commitment === c.hours;
                      return (
                        <button
                          key={c.hours}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            patch({ commitment: active ? null : c.hours })
                          }
                          className={cn(
                            "min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40",
                            active
                              ? "border-saffron bg-saffron text-cream"
                              : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk",
                          )}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration */}
                <div className="flex flex-col gap-3">
                  <label htmlFor="duration" className="text-caption text-ink">
                    Expected duration <span className="text-ash">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {DURATIONS.map((d) => {
                      const active = data.duration === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={active}
                          onClick={() => patch({ duration: active ? "" : d })}
                          className={cn(
                            "min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40",
                            active
                              ? "border-saffron bg-saffron text-cream"
                              : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk",
                          )}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    id="duration"
                    value={DURATIONS.includes(data.duration) ? "" : data.duration}
                    onChange={(e) => patch({ duration: e.target.value })}
                    maxLength={40}
                    placeholder="or type your own, e.g. 8 weeks"
                    className="h-11 w-full max-w-xs rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                  />
                </div>
              </div>
            )}

            {/* ---------- Step 4: Preview ---------- */}
            {currentKey === "preview" && (
              <div className="space-y-8">
                <p className="text-sm text-ash">
                  This is exactly how your brief will appear. Nothing goes live until you publish.
                </p>

                {/* Card preview (mirrors the Collabs grid card) */}
                <div>
                  <p className="mb-2 text-caption text-ash">On the Collabs grid</p>
                  <div className="max-w-sm rounded-lg border border-bone bg-paper p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-base font-semibold text-ink">
                        {trimmedTitle || "Untitled project"}
                      </h3>
                      <Tag variant="saffron" className="shrink-0">Open</Tag>
                    </div>
                    {categoryLabel && (
                      <div className="mt-2">
                        <Tag variant="outline" className="text-[11px]">{categoryLabel}</Tag>
                      </div>
                    )}
                    <p className="mt-3 line-clamp-2 text-sm text-ash">
                      {leadLine(data.brief) || "Your brief will show here."}
                    </p>
                    {previewRoles.length > 0 && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-ash">
                        <Users className="size-3.5" />
                        {previewRoles.slice(0, 2).map((r) => r.title.trim()).join(", ")}
                        {previewRoles.length > 2 ? ` +${previewRoles.length - 2}` : ""}
                      </p>
                    )}
                    {commitmentLabel && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ash">
                        <Clock className="size-3.5" /> {commitmentLabel}
                      </p>
                    )}
                  </div>
                </div>

                {/* Hero preview (mirrors the project page hero) */}
                <div>
                  <p className="mb-2 text-caption text-ash">On the project page</p>
                  <div className="rounded-lg border border-bone bg-paper p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {categoryLabel && <Tag variant="outline">{categoryLabel}</Tag>}
                      <Tag variant="saffron">Open</Tag>
                    </div>
                    <h2 className="mt-4 font-serif text-2xl leading-tight text-ink sm:text-3xl">
                      {trimmedTitle || "Untitled project"}
                    </h2>
                    {leadLine(data.brief) && (
                      <p className="mt-3 text-body text-ash">{leadLine(data.brief)}</p>
                    )}
                    {(commitmentLabel || data.duration.trim()) && (
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ash">
                        {commitmentLabel && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="size-4" /> {commitmentLabel}
                          </span>
                        )}
                        {data.duration.trim() && (
                          <span className="flex items-center gap-1.5">
                            <CalendarRange className="size-4" /> {data.duration.trim()}
                          </span>
                        )}
                      </div>
                    )}
                    {previewRoles.length > 0 && (
                      <div className="mt-6">
                        <p className="text-caption text-ash">Roles needed</p>
                        <div className="mt-3 space-y-3">
                          {previewRoles.map((r) => (
                            <div key={r.id} className="rounded-md border border-bone p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-ink">{r.title.trim()}</p>
                                <span className="text-xs text-ash">
                                  {r.count} needed
                                </span>
                              </div>
                              {r.skills.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {r.skills.map((s) => (
                                    <Tag key={s} variant="default" className="text-[11px]">
                                      {s}
                                    </Tag>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="mt-10 border-t border-bone pt-6">
        <div aria-live="polite" role="status" className="mb-2 min-h-4 text-right">
          {error ? (
            <span className="text-sm text-ember">{error}</span>
          ) : gateHint ? (
            <span className="text-xs text-ash">{gateHint}</span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={index === 0}
            className="gap-2"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>

          {currentKey === "preview" ? (
            <Button
              type="button"
              size="lg"
              onClick={publish}
              disabled={pending}
              className="gap-2"
            >
              {pending ? "Publishing..." : "Publish brief"}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={next}
              disabled={!canContinue}
              className="gap-2"
            >
              Continue <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
