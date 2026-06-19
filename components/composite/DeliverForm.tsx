"use client";

import { useTransition, useState } from "react";
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await markDeliveredAction(projectId, shortId, url);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          label="Deliverable URL"
          placeholder="https://github.com/yourteam/project"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
        />
      </div>
      <Button type="submit" disabled={pending || !url.trim()} size="md">
        {pending ? "Marking..." : "Mark delivered"}
      </Button>
      {error && <p className="text-sm text-ember">{error}</p>}
    </form>
  );
}
