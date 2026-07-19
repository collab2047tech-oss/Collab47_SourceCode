"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/primitives/Button";
import { cn } from "@/lib/cn";
import { applyToProjectAction } from "@/app/c/[short_id]/actions";

interface ApplyFormProps {
  projectId: string;
  shortId: string;
  /**
   * Role titles the project needs. When present, the applicant picks the role
   * they are applying for and it is prefixed into the pitch as
   * "[Applying for: <role>]" - applications stay project-level in the DB.
   */
  roles?: string[];
}

const PITCH_MAX = 800;

export function ApplyForm({ projectId, shortId, roles }: ApplyFormProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [links, setLinks] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(
    () => (roles && roles.length > 0 ? roles[0] : null),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const submittedRef = useRef(false);

  const hasRoles = !!roles && roles.length > 0;

  // Per-role Apply buttons on the project page link to "#apply-role-<n>". Read
  // that on mount + on hash change to preselect the clicked role and scroll the
  // form into view - this is what makes each role's Apply button "prefill".
  useEffect(() => {
    if (!hasRoles) return;
    const applyHash = () => {
      const m = /^#apply-role-(\d+)$/.exec(window.location.hash);
      if (!m) return;
      const n = Number.parseInt(m[1], 10);
      if (n >= 0 && n < roles!.length) {
        setSelectedRole(roles![n]);
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [hasRoles, roles]);

  // Unsaved-changes guard: a typed-but-unsent pitch survives an accidental nav.
  const dirty = pitch.trim().length > 0 || links.trim().length > 0;
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

  const prefix = selectedRole ? `[Applying for: ${selectedRole}]\n\n` : "";
  const pitchBudget = Math.max(0, PITCH_MAX - prefix.length);
  const total = prefix.length + pitch.length;

  // Live link validation: report the ones that would be dropped (non-http(s))
  // instead of silently discarding them server-side.
  const invalidLinkCount = useMemo(() => {
    return links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^https?:\/\//i.test(l)).length;
  }, [links]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("shortId", shortId);
    fd.set("pitch", `${prefix}${pitch}`.slice(0, PITCH_MAX));
    fd.set("links", links);
    startTransition(async () => {
      const result = await applyToProjectAction(fd);
      if (result.ok) {
        submittedRef.current = true;
        setDone(true);
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
          {selectedRole
            ? `The author will review your pitch for ${selectedRole} and get back to you.`
            : "The author will review your pitch and get back to you."}
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} id="apply" className="scroll-mt-28 rounded-lg border border-bone bg-paper p-6">
      <h2 className="text-h3 font-semibold text-ink">Apply with a pitch</h2>
      <p className="mt-1 text-sm text-ash">
        Tell the author why you are the right person for this project.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {hasRoles && (
          <div className="flex flex-col gap-2">
            <span className="text-caption text-ink">Which role are you applying for?</span>
            <div className="flex flex-wrap gap-2">
              {roles!.map((r) => {
                const active = selectedRole === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedRole(active ? null : r)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40",
                      active
                        ? "border-saffron bg-saffron text-cream"
                        : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk",
                    )}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-ash">
              {selectedRole
                ? `Your pitch will be tagged "Applying for: ${selectedRole}".`
                : "Applying generally - tap a role above to target one."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="pitch" className="text-caption text-ink">
              Your pitch
            </label>
            <span className={cn("text-caption tabular-nums", total > PITCH_MAX - 40 ? "text-ember" : "text-ash")}>
              {total}/{PITCH_MAX}
            </span>
          </div>
          <textarea
            id="pitch"
            required
            rows={5}
            maxLength={pitchBudget}
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="What will you bring to this project? Be specific."
            className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
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
            rows={3}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={"https://github.com/you\nhttps://your-portfolio.com"}
            className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
          />
          {invalidLinkCount > 0 && (
            <p className="text-xs text-ember" aria-live="polite">
              {invalidLinkCount} link{invalidLinkCount === 1 ? "" : "s"} must start with http:// or
              https:// or {invalidLinkCount === 1 ? "it" : "they"} won&apos;t be added.
            </p>
          )}
        </div>

        <div aria-live="polite">
          {error && <p className="text-sm text-ember">{error}</p>}
        </div>

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending..." : "Send application"}
        </Button>
      </form>
    </div>
  );
}
