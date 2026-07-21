"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { cn } from "@/lib/cn";
import { useEditableProfile } from "./EditableProfileProvider";
import { Modal } from "./Modal";

// Honorific chips - the SAME list used at onboarding (Mr/Dr/...).
const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Prof", "Er"] as const;

// Branch options mirror the full editor (ProfileEditForm). The current value is
// injected below if it is not already in the list, so an existing selection is
// never silently dropped.
const BRANCHES = [
  "CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "Chemical", "Biotechnology",
  "Mathematics", "Physics", "Commerce", "Economics", "MBA", "Law", "Design",
  "Architecture", "Other",
];

const YEARS = ["1st", "2nd", "3rd", "4th", "5th", "Postgrad", "Alumni"];

const BIO_MAX = 280;

const selectCls =
  "h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink transition-colors focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30";

/** Options list that always includes `current`, even if it is off-list. */
function withCurrent(list: string[], current: string): string[] {
  if (current && !list.includes(current)) return [current, ...list];
  return list;
}

export function EditIntroModal({ onClose }: { onClose: () => void }) {
  const { values, save } = useEditableProfile();
  const [name, setName] = useState(values.name);
  const [title, setTitle] = useState(values.title);
  const [bio, setBio] = useState(values.bio);
  const [college, setCollege] = useState(values.college);
  const [branch, setBranch] = useState(values.branch);
  const [city, setCity] = useState(values.city);
  const [year, setYear] = useState(values.year_of_study);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Your name can't be empty.");
      return;
    }
    setNameError(null);
    setError(null);
    setPending(true);
    const res = await save({
      name: trimmedName,
      title,
      bio: bio.trim(),
      college: college.trim(),
      branch,
      city: city.trim(),
      year_of_study: year,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <Modal
      title="Edit intro"
      onClose={() => !pending && onClose()}
      footer={
        <>
          <button
            type="button"
            onClick={() => !pending && onClose()}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          >
            Cancel
          </button>
          <Button type="submit" form="edit-intro-form" size="md" disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="edit-intro-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Input
            label="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            required
            maxLength={80}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "intro-name-error" : undefined}
            placeholder="Your full name"
          />
          {nameError ? (
            <p id="intro-name-error" className="mt-1.5 text-sm text-ember" aria-live="polite">
              {nameError}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-ash">Name can be changed once every 7 days.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-caption text-ink">Title (optional)</span>
          <div className="flex flex-wrap gap-2">
            {TITLES.map((t) => {
              const active = title === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTitle(active ? "" : t)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron",
                    active
                      ? "border-saffron bg-saffron text-cream"
                      : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="intro-bio" className="text-caption text-ink">
            Bio
          </label>
          <textarea
            id="intro-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            maxLength={BIO_MAX}
            rows={4}
            placeholder="Tell the network what you are building, studying, or exploring..."
            className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30"
          />
          <p className="text-right text-xs text-ash">
            {bio.length}/{BIO_MAX}
          </p>
        </div>

        <Input
          label="Institute"
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          maxLength={120}
          placeholder="e.g. Punjabi University"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="intro-branch" className="text-caption text-ink">
              Branch
            </label>
            <select
              id="intro-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className={selectCls}
            >
              <option value="">Select branch</option>
              {withCurrent(BRANCHES, branch).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="intro-year" className="text-caption text-ink">
              Year of study
            </label>
            <select
              id="intro-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={selectCls}
            >
              <option value="">Select year</option>
              {withCurrent(YEARS, year).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={80}
          placeholder="e.g. your city"
        />

        {error ? (
          <p className="flex items-start gap-1.5 text-sm text-ember" role="alert" aria-live="assertive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
