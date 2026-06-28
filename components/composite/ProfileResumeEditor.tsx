"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
  Briefcase,
  GraduationCap,
  Wrench,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { Tag } from "@/components/primitives/Tag";
import {
  ExperienceItem,
  EducationItem,
  EXPERIENCE_TYPES,
} from "@/components/composite/ProfileResume";
import {
  saveExperienceAction,
  deleteExperienceAction,
  saveEducationAction,
  deleteEducationAction,
  addSkillAction,
  deleteSkillAction,
} from "@/app/(app)/profile/resume-actions";
import type {
  Resume,
  Experience,
  Education,
  Skill,
  ExperienceType,
  SkillCategory,
} from "@/lib/db/resume";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A stable, collision-safe temp id for optimistic inserts.
function tempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ISO date string <-> "YYYY-MM" for type="month" inputs. */
function isoToMonth(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 7);
}
function monthToIso(month: string): string | null {
  if (!month) return null;
  return `${month}-01`;
}

const SKILL_CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: "technical", label: "Technical" },
  { id: "tool", label: "Tool" },
  { id: "language", label: "Language" },
  { id: "soft", label: "Soft skill" },
];

const SKILL_GROUPS: { id: SkillCategory; label: string }[] = [
  { id: "technical", label: "Technical" },
  { id: "tool", label: "Tools" },
  { id: "language", label: "Languages" },
  { id: "soft", label: "Soft skills" },
];

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-bone bg-paper shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-bone px-6 py-4">
          <h3 className="font-serif text-xl text-ink" style={{ letterSpacing: "-0.01em" }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-ash transition-colors hover:bg-bone hover:text-ink"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// Shared labeled field wrapper (mirrors Input's label styling).
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-caption text-ink">{label}</span>
      {children}
    </div>
  );
}

const selectCls =
  "h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink transition-colors focus:border-ink focus:outline-none";
const textareaCls =
  "w-full rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none resize-none";
const monthCls =
  "h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink transition-colors focus:border-ink focus:outline-none disabled:bg-cream disabled:text-ash disabled:cursor-not-allowed";

// ---------------------------------------------------------------------------
// Experience form
// ---------------------------------------------------------------------------

type ExperienceDraft = {
  type: ExperienceType;
  title: string;
  organization: string;
  location: string;
  start: string; // YYYY-MM
  end: string; // YYYY-MM
  is_current: boolean;
  description: string;
  skills: string;
  url: string;
};

function ExperienceForm({
  initial,
  onCancel,
  onSubmit,
  pending,
  error,
}: {
  initial: Experience | null;
  onCancel: () => void;
  onSubmit: (draft: ExperienceDraft) => void;
  pending: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<ExperienceDraft>({
    type: initial?.type ?? "work",
    title: initial?.title ?? "",
    organization: initial?.organization ?? "",
    location: initial?.location ?? "",
    start: isoToMonth(initial?.start_date ?? null),
    end: isoToMonth(initial?.end_date ?? null),
    is_current: initial?.is_current ?? false,
    description: initial?.description ?? "",
    skills: (initial?.skills ?? []).join(", "),
    url: initial?.url ?? "",
  });

  const set = <K extends keyof ExperienceDraft>(k: K, v: ExperienceDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
      className="space-y-4"
    >
      <Field label="Type">
        <select className={selectCls} value={draft.type} onChange={(e) => set("type", e.target.value as ExperienceType)}>
          {EXPERIENCE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Input
        label="Title"
        value={draft.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="e.g. Frontend Engineer"
        required
        maxLength={150}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Organization"
          value={draft.organization}
          onChange={(e) => set("organization", e.target.value)}
          placeholder="e.g. Collab47"
          maxLength={150}
        />
        <Input
          label="Location"
          value={draft.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="e.g. Remote"
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start">
          <input type="month" className={monthCls} value={draft.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field label="End">
          <input
            type="month"
            className={monthCls}
            value={draft.is_current ? "" : draft.end}
            disabled={draft.is_current}
            onChange={(e) => set("end", e.target.value)}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={draft.is_current}
          onChange={(e) => set("is_current", e.target.checked)}
          className="size-4 rounded border-ink/30 accent-saffron"
        />
        I currently do this
      </label>

      <Field label="Description">
        <textarea
          rows={4}
          className={textareaCls}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What did you build, own, or achieve?"
          maxLength={2000}
        />
      </Field>

      <Input
        label="Skills (comma separated)"
        value={draft.skills}
        onChange={(e) => set("skills", e.target.value)}
        placeholder="react, typescript, figma"
      />

      <Input
        label="Link (optional)"
        value={draft.url}
        onChange={(e) => set("url", e.target.value)}
        placeholder="https://..."
        maxLength={300}
      />

      {error ? <p className="text-sm text-ember">{error}</p> : null}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <button type="button" onClick={onCancel} className="text-sm text-ash transition-colors hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Education form
// ---------------------------------------------------------------------------

type EducationDraft = {
  institution: string;
  degree: string;
  field_of_study: string;
  start: string;
  end: string;
  is_current: boolean;
  grade: string;
  description: string;
};

function EducationForm({
  initial,
  onCancel,
  onSubmit,
  pending,
  error,
}: {
  initial: Education | null;
  onCancel: () => void;
  onSubmit: (draft: EducationDraft) => void;
  pending: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<EducationDraft>({
    institution: initial?.institution ?? "",
    degree: initial?.degree ?? "",
    field_of_study: initial?.field_of_study ?? "",
    start: isoToMonth(initial?.start_date ?? null),
    end: isoToMonth(initial?.end_date ?? null),
    is_current: initial?.is_current ?? false,
    grade: initial?.grade ?? "",
    description: initial?.description ?? "",
  });

  const set = <K extends keyof EducationDraft>(k: K, v: EducationDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
      className="space-y-4"
    >
      <Input
        label="Institution"
        value={draft.institution}
        onChange={(e) => set("institution", e.target.value)}
        placeholder="e.g. Punjabi University"
        required
        maxLength={200}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Degree"
          value={draft.degree}
          onChange={(e) => set("degree", e.target.value)}
          placeholder="e.g. B.Tech"
          maxLength={120}
        />
        <Input
          label="Field of study"
          value={draft.field_of_study}
          onChange={(e) => set("field_of_study", e.target.value)}
          placeholder="e.g. Computer Science"
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start">
          <input type="month" className={monthCls} value={draft.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field label="End">
          <input
            type="month"
            className={monthCls}
            value={draft.is_current ? "" : draft.end}
            disabled={draft.is_current}
            onChange={(e) => set("end", e.target.value)}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={draft.is_current}
          onChange={(e) => set("is_current", e.target.checked)}
          className="size-4 rounded border-ink/30 accent-saffron"
        />
        I currently study here
      </label>

      <Input
        label="Grade (optional)"
        value={draft.grade}
        onChange={(e) => set("grade", e.target.value)}
        placeholder="e.g. 8.6 CGPA"
        maxLength={60}
      />

      <Field label="Description (optional)">
        <textarea
          rows={3}
          className={textareaCls}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Activities, honors, focus areas..."
          maxLength={2000}
        />
      </Field>

      {error ? <p className="text-sm text-ember">{error}</p> : null}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <button type="button" onClick={onCancel} className="text-sm text-ash transition-colors hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Owner row wrapper: hover-revealed edit/delete controls over a read-only item.
// ---------------------------------------------------------------------------

function OwnerRow({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group/row relative -mx-2 rounded-lg px-2 transition-colors hover:bg-cream/50">
      {children}
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit"
          title="Edit"
          className="flex size-7 items-center justify-center rounded-full border border-bone bg-paper text-ash transition-colors hover:border-saffron hover:text-saffron-dk"
        >
          <Pencil className="size-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          title="Delete"
          className="flex size-7 items-center justify-center rounded-full border border-bone bg-paper text-ash transition-colors hover:border-ember hover:text-ember"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-bone bg-paper px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-saffron hover:text-saffron-dk"
    >
      <Plus className="size-4" strokeWidth={2} /> {label}
    </button>
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-serif text-lg text-ink" style={{ letterSpacing: "-0.01em" }}>
        <span className="text-ash">{icon}</span>
        {title}
      </h3>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function ProfileResumeEditor({ resume }: { resume: Resume }) {
  const [experience, setExperience] = useState<Experience[]>(resume.experience);
  const [education, setEducation] = useState<Education[]>(resume.education);
  const [skills, setSkills] = useState<Skill[]>(resume.skills);
  const [, startTransition] = useTransition();

  // Modal state: which form is open (and the item being edited, if any).
  const [expEditing, setExpEditing] = useState<{ item: Experience | null } | null>(null);
  const [eduEditing, setEduEditing] = useState<{ item: Education | null } | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Skill composer.
  const [skillName, setSkillName] = useState("");
  const [skillCat, setSkillCat] = useState<SkillCategory>("technical");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillPending, startSkill] = useTransition();

  // Banner error for delete failures.
  const [rowError, setRowError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Experience CRUD
  // -------------------------------------------------------------------------

  function submitExperience(draft: ExperienceDraft) {
    const editingItem = expEditing?.item ?? null;
    const skillsArr = draft.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const optimistic: Experience = {
      id: editingItem?.id ?? tempId(),
      user_id: editingItem?.user_id ?? "",
      type: draft.type,
      title: draft.title.trim(),
      organization: draft.organization.trim() || null,
      location: draft.location.trim() || null,
      start_date: monthToIso(draft.start),
      end_date: draft.is_current ? null : monthToIso(draft.end),
      is_current: draft.is_current,
      description: draft.description.trim() || null,
      skills: skillsArr,
      url: draft.url.trim() || null,
      sort_order: editingItem?.sort_order ?? 0,
    };

    if (!optimistic.title) {
      setFormError("Title is required");
      return;
    }

    const prev = experience;
    // Optimistic apply.
    setExperience((list) =>
      editingItem ? list.map((e) => (e.id === editingItem.id ? optimistic : e)) : [optimistic, ...list]
    );
    setFormError(null);
    setFormPending(true);

    startTransition(async () => {
      const res = await saveExperienceAction({
        id: editingItem?.id,
        type: optimistic.type,
        title: optimistic.title,
        organization: optimistic.organization,
        location: optimistic.location,
        start_date: optimistic.start_date,
        end_date: optimistic.end_date,
        is_current: optimistic.is_current,
        description: optimistic.description,
        skills: optimistic.skills,
        url: optimistic.url,
      });
      setFormPending(false);
      if (!res.ok) {
        setExperience(prev); // roll back
        setFormError(res.error);
        return;
      }
      // Reconcile the temp id with the real server id on insert.
      if (!editingItem && res.data?.id) {
        const realId = res.data.id;
        setExperience((list) => list.map((e) => (e.id === optimistic.id ? { ...e, id: realId } : e)));
      }
      setExpEditing(null);
    });
  }

  function removeExperience(item: Experience) {
    if (!confirm("Delete this experience? This cannot be undone.")) return;
    const prev = experience;
    setExperience((list) => list.filter((e) => e.id !== item.id));
    setRowError(null);
    startTransition(async () => {
      const res = await deleteExperienceAction(item.id);
      if (!res.ok) {
        setExperience(prev);
        setRowError(res.error);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Education CRUD
  // -------------------------------------------------------------------------

  function submitEducation(draft: EducationDraft) {
    const editingItem = eduEditing?.item ?? null;
    const optimistic: Education = {
      id: editingItem?.id ?? tempId(),
      user_id: editingItem?.user_id ?? "",
      institution: draft.institution.trim(),
      degree: draft.degree.trim() || null,
      field_of_study: draft.field_of_study.trim() || null,
      start_date: monthToIso(draft.start),
      end_date: draft.is_current ? null : monthToIso(draft.end),
      is_current: draft.is_current,
      grade: draft.grade.trim() || null,
      description: draft.description.trim() || null,
      sort_order: editingItem?.sort_order ?? 0,
    };

    if (!optimistic.institution) {
      setFormError("Institution is required");
      return;
    }

    const prev = education;
    setEducation((list) =>
      editingItem ? list.map((e) => (e.id === editingItem.id ? optimistic : e)) : [optimistic, ...list]
    );
    setFormError(null);
    setFormPending(true);

    startTransition(async () => {
      const res = await saveEducationAction({
        id: editingItem?.id,
        institution: optimistic.institution,
        degree: optimistic.degree,
        field_of_study: optimistic.field_of_study,
        start_date: optimistic.start_date,
        end_date: optimistic.end_date,
        is_current: optimistic.is_current,
        grade: optimistic.grade,
        description: optimistic.description,
      });
      setFormPending(false);
      if (!res.ok) {
        setEducation(prev);
        setFormError(res.error);
        return;
      }
      if (!editingItem && res.data?.id) {
        const realId = res.data.id;
        setEducation((list) => list.map((e) => (e.id === optimistic.id ? { ...e, id: realId } : e)));
      }
      setEduEditing(null);
    });
  }

  function removeEducation(item: Education) {
    if (!confirm("Delete this education entry? This cannot be undone.")) return;
    const prev = education;
    setEducation((list) => list.filter((e) => e.id !== item.id));
    setRowError(null);
    startTransition(async () => {
      const res = await deleteEducationAction(item.id);
      if (!res.ok) {
        setEducation(prev);
        setRowError(res.error);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Skills CRUD
  // -------------------------------------------------------------------------

  function addSkill() {
    const name = skillName.trim();
    if (!name) return;
    // Guard against client-side duplicates before hitting the server.
    if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.category === skillCat)) {
      setSkillError("You already added that skill");
      return;
    }
    const optimistic: Skill = { id: tempId(), user_id: "", name, category: skillCat };
    const prev = skills;
    setSkills((list) => [...list, optimistic]);
    setSkillName("");
    setSkillError(null);
    startSkill(async () => {
      const res = await addSkillAction(name, skillCat);
      if (!res.ok) {
        setSkills(prev);
        setSkillError(res.error);
        return;
      }
      if (res.data?.id) {
        const realId = res.data.id;
        setSkills((list) => list.map((s) => (s.id === optimistic.id ? { ...s, id: realId } : s)));
      }
    });
  }

  const removeSkill = useCallback(
    (skill: Skill) => {
      setSkillError(null);
      // Snapshot for rollback, then apply optimistically.
      setSkills((prev) => {
        const snapshot = prev;
        startTransition(async () => {
          const res = await deleteSkillAction(skill.id);
          if (!res.ok) {
            setSkills(snapshot); // roll back to the captured snapshot
            setSkillError(res.error);
          }
        });
        return prev.filter((s) => s.id !== skill.id);
      });
    },
    [startTransition]
  );

  const isEmpty = experience.length === 0 && education.length === 0 && skills.length === 0;

  return (
    <div className="space-y-5">
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-bone bg-paper/60 p-8 text-center">
          <p className="text-sm leading-relaxed text-ash">
            Add your experience, education and skills to complete your profile.
          </p>
        </div>
      ) : null}

      {rowError ? (
        <p className="rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">{rowError}</p>
      ) : null}

      {/* ---- Experience ---- */}
      <div className="rounded-xl border border-bone bg-paper p-6">
        <SectionHeader
          title="Experience"
          icon={<Briefcase className="size-4" strokeWidth={1.75} />}
          action={<AddButton label="Add" onClick={() => { setFormError(null); setExpEditing({ item: null }); }} />}
        />
        {experience.length === 0 ? (
          <p className="text-sm text-ash">No experience added yet.</p>
        ) : (
          <ol>
            {experience.map((e, i) => (
              <OwnerRow
                key={e.id}
                onEdit={() => { setFormError(null); setExpEditing({ item: e }); }}
                onDelete={() => removeExperience(e)}
              >
                <ExperienceItem item={e} last={i === experience.length - 1} />
              </OwnerRow>
            ))}
          </ol>
        )}
      </div>

      {/* ---- Education ---- */}
      <div className="rounded-xl border border-bone bg-paper p-6">
        <SectionHeader
          title="Education"
          icon={<GraduationCap className="size-4" strokeWidth={1.75} />}
          action={<AddButton label="Add" onClick={() => { setFormError(null); setEduEditing({ item: null }); }} />}
        />
        {education.length === 0 ? (
          <p className="text-sm text-ash">No education added yet.</p>
        ) : (
          <ol>
            {education.map((e, i) => (
              <OwnerRow
                key={e.id}
                onEdit={() => { setFormError(null); setEduEditing({ item: e }); }}
                onDelete={() => removeEducation(e)}
              >
                <EducationItem item={e} last={i === education.length - 1} />
              </OwnerRow>
            ))}
          </ol>
        )}
      </div>

      {/* ---- Skills ---- */}
      <div className="rounded-xl border border-bone bg-paper p-6">
        <SectionHeader title="Skills" icon={<Wrench className="size-4" strokeWidth={1.75} />} action={null} />

        {/* Composer */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Add a skill"
              value={skillName}
              onChange={(e) => { setSkillName(e.target.value); setSkillError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="e.g. TypeScript"
              maxLength={50}
            />
          </div>
          <div className="sm:w-44">
            <Field label="Category">
              <select className={selectCls} value={skillCat} onChange={(e) => setSkillCat(e.target.value as SkillCategory)}>
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="button" size="md" onClick={addSkill} disabled={skillPending || !skillName.trim()} className="shrink-0">
            <Check className="size-4" /> Add
          </Button>
        </div>
        {skillError ? <p className="mt-2 text-sm text-ember">{skillError}</p> : null}

        {/* Grouped chips */}
        <div className="mt-5 space-y-4">
          {SKILL_GROUPS.map((group) => {
            const items = skills.filter((s) => s.category === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-ash">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-bone py-1 pl-3 pr-1.5 text-xs font-medium tracking-wide text-ink"
                    >
                      <span className="capitalize">{s.name}</span>
                      <button
                        type="button"
                        onClick={() => removeSkill(s)}
                        aria-label={`Remove ${s.name}`}
                        className="flex size-4 items-center justify-center rounded-full text-ash transition-colors hover:bg-ember/15 hover:text-ember"
                      >
                        <X className="size-3" strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {skills.length === 0 ? <p className="text-sm text-ash">No skills added yet.</p> : null}
        </div>
      </div>

      {/* ---- Modals ---- */}
      {expEditing ? (
        <Modal
          title={expEditing.item ? "Edit experience" : "Add experience"}
          onClose={() => { if (!formPending) setExpEditing(null); }}
        >
          <ExperienceForm
            initial={expEditing.item}
            onCancel={() => setExpEditing(null)}
            onSubmit={submitExperience}
            pending={formPending}
            error={formError}
          />
        </Modal>
      ) : null}

      {eduEditing ? (
        <Modal
          title={eduEditing.item ? "Edit education" : "Add education"}
          onClose={() => { if (!formPending) setEduEditing(null); }}
        >
          <EducationForm
            initial={eduEditing.item}
            onCancel={() => setEduEditing(null)}
            onSubmit={submitEducation}
            pending={formPending}
            error={formError}
          />
        </Modal>
      ) : null}
    </div>
  );
}
