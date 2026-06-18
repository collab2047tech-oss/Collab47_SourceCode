"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/primitives/Button";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: "post" | "profile";
  targetId: string;
  onSubmit: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

const CATEGORIES = [
  { id: "spam", label: "Spam or scam", desc: "Promotional, fake, or repetitive content." },
  { id: "hate", label: "Hate or harassment", desc: "Targeted abuse or hateful content." },
  { id: "sexual", label: "Sexual content", desc: "Explicit or unwanted sexual content." },
  { id: "other", label: "Something else", desc: "Describe below." },
] as const;

export function ReportModal({ open, onClose, targetType, targetId, onSubmit }: ReportModalProps) {
  const [category, setCategory] = useState<string>("spam");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setCategory("spam");
      setBody("");
      setDone(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function handle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("targetType", targetType);
    fd.set("targetId", targetId);
    fd.set("category", category);
    fd.set("body", body);
    start(async () => {
      const res = await onSubmit(fd);
      if (res.ok) {
        setDone(true);
        setTimeout(onClose, 1200);
      } else {
        setError(res.error ?? "Could not submit. Try again.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-bone bg-paper p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-caption">Report</p>
            <h2 className="mt-1 font-serif text-2xl text-ink">
              {targetType === "post" ? "Report this post" : "Report this profile"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-ash transition-colors hover:bg-bone">
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          <p className="mt-8 text-body text-moss">
            Report sent. We review every flag within 24 hours.
          </p>
        ) : (
          <form onSubmit={handle} className="mt-6 space-y-4">
            <fieldset className="space-y-2">
              {CATEGORIES.map((c) => (
                <label
                  key={c.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                    category === c.id
                      ? "border-saffron bg-saffron/5"
                      : "border-bone hover:border-ink/30"
                  )}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c.id}
                    checked={category === c.id}
                    onChange={() => setCategory(c.id)}
                    className="mt-1 accent-saffron"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">{c.label}</p>
                    <p className="mt-0.5 text-xs text-ash">{c.desc}</p>
                  </div>
                </label>
              ))}
            </fieldset>

            <div>
              <label className="text-caption" htmlFor="report-body">Details (optional)</label>
              <textarea
                id="report-body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 300))}
                rows={3}
                className="mt-2 w-full rounded-md border border-bone bg-cream p-3 text-sm text-ink placeholder:text-ash focus:border-ink focus:outline-none"
                placeholder="What is wrong with this?"
              />
              <p className="mt-1 text-right text-caption">{body.length}/300</p>
            </div>

            {error ? (
              <p className="rounded-md bg-ember/10 p-2 text-sm text-ember">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Sending..." : "Submit report"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
