"use client";

import { useTransition, useState, useRef } from "react";
import { Button } from "@/components/primitives/Button";
import { applyToProjectAction } from "@/app/c/[short_id]/actions";

interface ApplyFormProps {
  projectId: string;
  shortId: string;
}

export function ApplyForm({ projectId, shortId }: ApplyFormProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pitchLen, setPitchLen] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("projectId", projectId);
    fd.set("shortId", shortId);
    startTransition(async () => {
      const result = await applyToProjectAction(fd);
      if (result.ok) {
        setDone(true);
        formRef.current?.reset();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-moss/30 bg-moss/5 px-6 py-5">
        <p className="font-medium text-moss">Application sent</p>
        <p className="mt-1 text-sm text-ash">
          The author will review your pitch and get back to you.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-bone bg-paper p-6">
      <h2 className="text-h3 font-semibold text-ink">Apply with a pitch</h2>
      <p className="mt-1 text-sm text-ash">
        Tell the author why you are the right person for this project.
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="pitch" className="text-caption text-ink">
              Your pitch
            </label>
            <span
              className={`text-caption ${pitchLen > 800 ? "text-ember" : "text-ash"}`}
            >
              {pitchLen}/800
            </span>
          </div>
          <textarea
            id="pitch"
            name="pitch"
            required
            rows={5}
            maxLength={800}
            placeholder="What will you bring to this project? Be specific."
            onChange={(e) => setPitchLen(e.target.value.length)}
            className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="links" className="text-caption text-ink">
            Links <span className="text-ash">(optional)</span>
          </label>
          <p className="text-xs text-ash">
            One link per line, up to 3. Portfolio, GitHub, Behance, etc.
          </p>
          <textarea
            id="links"
            name="links"
            rows={3}
            placeholder={"https://github.com/you\nhttps://your-portfolio.com"}
            className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-ember">{error}</p>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending..." : "Send application"}
        </Button>
      </form>
    </div>
  );
}
