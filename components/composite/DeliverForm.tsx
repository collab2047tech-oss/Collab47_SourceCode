"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { markDeliveredAction } from "@/app/c/[short_id]/progress-actions";

interface DeliverFormProps {
  projectId: string;
  shortId: string;
}

export function DeliverForm({ projectId, shortId }: DeliverFormProps) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await markDeliveredAction(projectId, shortId, url);
      if (result.ok) {
        setDone(true);
        setConfirming(false);
      } else {
        setError(result.error ?? "Something went wrong.");
        setConfirming(false);
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Marking delivered is irreversible (it verifies the whole team) - confirm
    // before the transition rather than firing on the first click.
    if (!confirming) {
      setError(null);
      setConfirming(true);
      return;
    }
    submit();
  }

  if (done) {
    return (
      <div className="mt-3 rounded-lg border border-moss/30 bg-moss/5 px-5 py-4">
        <p className="text-sm font-medium text-moss">Project marked delivered</p>
        <p className="mt-1 text-sm text-ash">
          Every member now carries the Verified contributor badge on their portfolio.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Deliverable URL"
            placeholder="https://github.com/yourteam/project"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setConfirming(false);
            }}
            type="url"
            required
          />
        </div>
        {confirming ? (
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" size="md" disabled={pending}>
              {pending ? "Marking..." : "Confirm - it's final"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="submit" disabled={pending || !url.trim()} size="md">
            Mark delivered
          </Button>
        )}
      </div>

      {confirming && !error && (
        <p className="text-sm text-ash">
          This verifies every team member and cannot be undone.
        </p>
      )}
      <div aria-live="polite">
        {error && <p className="text-sm text-ember">{error}</p>}
      </div>
    </form>
  );
}
