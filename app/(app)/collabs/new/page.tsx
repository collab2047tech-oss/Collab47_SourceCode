"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { createProjectAction } from "./actions";

export default function NewProjectPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [briefLen, setBriefLen] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createProjectAction(fd);
      if (result?.error) {
        setError(result.error);
      }
      // On success, createProjectAction redirects server-side
    });
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/collabs"
        className="inline-flex items-center gap-2 text-sm text-ash transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to Collabs
      </Link>
      <p className="mt-6 text-caption text-ash">Collab Projects</p>
      <h1 className="mt-2 font-serif text-h1 text-ink">
        Post a{" "}
        <span className="italic text-saffron">brief.</span>
      </h1>
      <p className="mt-3 text-body-sm text-ash">
        Describe your project and the kind of collaborators you need.
        Students apply with a pitch.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <Input
          label="Project title"
          name="title"
          required
          placeholder="e.g. Campus food-delivery app"
          maxLength={120}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="brief" className="text-caption text-ink">
              Brief
            </label>
            <span className="text-caption text-ash">{briefLen}/1000</span>
          </div>
          <textarea
            id="brief"
            name="brief"
            required
            rows={5}
            maxLength={1000}
            placeholder="What is this project about? Who are you looking for? What problem are you solving?"
            onChange={(e) => setBriefLen(e.target.value.length)}
            className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="deliverable" className="text-caption text-ink">
            Deliverable
          </label>
          <textarea
            id="deliverable"
            name="deliverable"
            required
            rows={2}
            maxLength={400}
            placeholder="What will the team produce? e.g. open-source repo + case study"
            className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Deadline"
            name="deadline"
            type="date"
            required
            min={new Date().toISOString().split("T")[0]}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="slot_count" className="text-caption text-ink">
              Team slots (1 to 8)
            </label>
            <input
              id="slot_count"
              name="slot_count"
              type="number"
              required
              min={1}
              max={8}
              defaultValue={3}
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-ember">{error}</p>
        )}

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Publishing..." : "Publish brief"}
          </Button>
        </div>
      </form>
    </div>
  );
}
