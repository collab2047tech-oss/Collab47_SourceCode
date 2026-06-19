"use client";

import { useTransition, useState, useRef } from "react";
import { Button } from "@/components/primitives/Button";
import { postProgressUpdateAction } from "@/app/c/[short_id]/progress-actions";

interface ProgressComposerProps {
  projectId: string;
  shortId: string;
}

export function ProgressComposer({ projectId, shortId }: ProgressComposerProps) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await postProgressUpdateAction(projectId, shortId, text);
      if (result.ok) {
        setBody("");
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-lg border border-bone bg-paper p-4">
      <textarea
        ref={textareaRef}
        rows={3}
        maxLength={2000}
        placeholder="Share a quick progress update with the team..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full resize-none rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${body.length > 1900 ? "text-ember" : "text-ash"}`}>
          {body.length}/2000
        </span>
        <div className="flex items-center gap-3">
          {done && <span className="text-xs text-moss">Posted!</span>}
          {error && <span className="text-xs text-ember">{error}</span>}
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? "Posting..." : "Post update"}
          </Button>
        </div>
      </div>
    </form>
  );
}
