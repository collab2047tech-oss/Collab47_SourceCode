"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Bug, Lightbulb, MessageSquarePlus, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { submitFeedbackAction } from "@/app/(app)/feedback-actions";

type Kind = "bug" | "feature" | "other";

const KINDS: { id: Kind; label: string; icon: typeof Bug }[] = [
  { id: "bug", label: "Bug", icon: Bug },
  { id: "feature", label: "Feature idea", icon: Lightbulb },
  { id: "other", label: "Other", icon: MessageCircle },
];

const SUBJECT_MAX = 160;
const BODY_MAX = 4000;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  // Reset to a clean slate whenever the modal opens, and focus the subject field.
  useEffect(() => {
    if (!open) return;
    setKind("bug");
    setSubject("");
    setBody("");
    setError(null);
    setDone(false);
    const t = window.setTimeout(() => subjectRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape closes; lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Optional auto-grow for the details textarea.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [body, open]);

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    const page_url =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : undefined;
    const user_agent =
      typeof navigator !== "undefined" ? navigator.userAgent : undefined;

    start(async () => {
      const res = await submitFeedbackAction({
        kind,
        subject: subject.trim(),
        body: body.trim(),
        page_url,
        user_agent,
      });
      if (res.ok) {
        setDone(true);
        window.setTimeout(() => setOpen(false), 1500);
      } else {
        setError(res.error || "Could not send. Please try again.");
      }
    });
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Send feedback"
        className={cn(
          "fixed right-4 z-50 inline-flex items-center gap-2 rounded-full",
          "border border-bone bg-paper px-3.5 py-3 text-sm font-medium text-ink shadow-lg",
          "transition-all hover:-translate-y-0.5 hover:border-saffron/40 hover:text-saffron active:scale-95",
          "bottom-20 md:bottom-6 md:right-6"
        )}
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
        }}
      >
        <MessageSquarePlus className="size-5 shrink-0" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative flex w-full max-w-lg flex-col overflow-hidden bg-paper shadow-xl",
              "max-h-[90dvh] rounded-t-2xl border border-bone",
              "sm:rounded-2xl",
              "pb-[env(safe-area-inset-bottom,0px)]"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-bone px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-ash">
                  Feedback
                </p>
                <h2
                  id={titleId}
                  className="mt-0.5 font-serif text-xl text-ink"
                >
                  Tell us what is on your mind
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                className="-mr-1 shrink-0 rounded-full p-1.5 text-ash transition-colors hover:bg-bone hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {done ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-moss/10 text-moss">
                    <MessageSquarePlus className="size-6" />
                  </span>
                  <p className="font-serif text-lg text-ink">
                    Thanks - we got it.
                  </p>
                  <p className="text-sm text-ash">We read every report.</p>
                </div>
              ) : (
                <form id="feedback-form" onSubmit={handleSubmit} className="space-y-5">
                  {/* Segmented control */}
                  <div role="radiogroup" aria-label="Type of feedback">
                    <div className="grid grid-cols-3 gap-1 rounded-lg border border-bone bg-cream p-1">
                      {KINDS.map((k) => {
                        const active = kind === k.id;
                        return (
                          <button
                            key={k.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setKind(k.id)}
                            className={cn(
                              "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-all",
                              active
                                ? "bg-paper text-ink shadow-sm"
                                : "text-ash hover:text-ink"
                            )}
                          >
                            <k.icon className="size-4 shrink-0" />
                            <span className="truncate">{k.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label
                        htmlFor="feedback-subject"
                        className="text-xs font-medium uppercase tracking-wide text-ash"
                      >
                        Subject
                      </label>
                      <span className="text-xs tabular-nums text-ash">
                        {subject.length}/{SUBJECT_MAX}
                      </span>
                    </div>
                    <input
                      ref={subjectRef}
                      id="feedback-subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                      maxLength={SUBJECT_MAX}
                      required
                      placeholder="A short summary"
                      className="mt-1.5 h-11 w-full rounded-md border border-bone bg-cream px-3 text-sm text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
                    />
                  </div>

                  {/* Details */}
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label
                        htmlFor="feedback-body"
                        className="text-xs font-medium uppercase tracking-wide text-ash"
                      >
                        Details
                      </label>
                      <span className="text-xs tabular-nums text-ash">
                        {body.length}/{BODY_MAX}
                      </span>
                    </div>
                    <textarea
                      ref={bodyRef}
                      id="feedback-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                      maxLength={BODY_MAX}
                      required
                      rows={5}
                      placeholder="What happened? What did you expect? Steps to reproduce."
                      className="mt-1.5 max-h-80 w-full resize-none rounded-md border border-bone bg-cream p-3 text-sm leading-relaxed text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
                    />
                  </div>

                  {error ? (
                    <p
                      role="alert"
                      className="rounded-md bg-ember/10 px-3 py-2 text-sm text-ember"
                    >
                      {error}
                    </p>
                  ) : null}
                </form>
              )}
            </div>

            {/* Footer */}
            {!done ? (
              <div className="flex items-center justify-end gap-2 border-t border-bone px-5 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-ink transition-colors hover:bg-bone disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="feedback-form"
                  disabled={!canSubmit}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-saffron px-5 text-sm font-medium text-cream transition-all hover:bg-saffron-dk active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Sending..." : "Send feedback"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
