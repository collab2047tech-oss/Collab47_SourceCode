"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import {
  acceptApplicantAction,
  rejectApplicantAction,
  messageApplicantAction,
} from "@/app/c/[short_id]/actions";

interface Applicant {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
}

export interface ApplicationRow {
  id: string;
  applicant_id: string;
  pitch: string;
  links: string[];
  status: "pending" | "accepted" | "rejected";
  applicant: Applicant;
}

type Status = "pending" | "accepted" | "rejected";

interface ApplicationsPanelProps {
  projectId: string;
  shortId: string;
  applications: ApplicationRow[];
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function ApplicationsPanel({
  projectId,
  shortId,
  applications: initialApplications,
}: ApplicationsPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Record<string, Status>>(() =>
    Object.fromEntries(initialApplications.map((a) => [a.applicant_id, a.status])),
  );
  // Per-row concurrency + errors (the old panel disabled every row on one click
  // and showed a single shared error - both fixed here).
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ id: string; kind: "reject" | "remove" } | null>(null);

  const setStatus = (id: string, status: Status) =>
    setStatuses((s) => ({ ...s, [id]: status }));

  // Optimistic mutation with per-row rollback + inline error.
  function run(
    applicantId: string,
    optimistic: Status,
    action: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    const prev = statuses[applicantId];
    setStatus(applicantId, optimistic);
    setRowErrors((e) => ({ ...e, [applicantId]: "" }));
    setBusy((b) => ({ ...b, [applicantId]: true }));
    startTransition(async () => {
      const result = await action();
      setBusy((b) => ({ ...b, [applicantId]: false }));
      if (!result.ok) {
        setStatus(applicantId, prev);
        setRowErrors((e) => ({ ...e, [applicantId]: result.error ?? "Action failed." }));
      } else {
        router.refresh();
      }
    });
  }

  const handleAccept = (id: string) =>
    run(id, "accepted", () => acceptApplicantAction(projectId, id, shortId));

  // Reject (pending -> rejected) and Remove (accepted member -> off the team)
  // both go through rejectApplicantAction; the server deletes the membership and
  // reopens the project when a full team loses a member.
  const doReject = (id: string) =>
    run(id, "rejected", () => rejectApplicantAction(projectId, id, shortId));

  // Undo a rejection by re-accepting (the server's supported reverse path).
  const handleUndo = (id: string) =>
    run(id, "accepted", () => acceptApplicantAction(projectId, id, shortId));

  function handleMessage(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    setRowErrors((e) => ({ ...e, [id]: "" }));
    startTransition(async () => {
      const result = await messageApplicantAction(id);
      setBusy((b) => ({ ...b, [id]: false }));
      if (result.ok && result.conversationId) {
        router.push(`/messages/${result.conversationId}`);
      } else {
        setRowErrors((e) => ({ ...e, [id]: result.error ?? "Could not open conversation." }));
      }
    });
  }

  function runConfirm() {
    if (!confirm) return;
    const { id } = confirm;
    setConfirm(null);
    doReject(id);
  }

  if (initialApplications.length === 0) {
    return (
      <div>
        <h2 className="text-caption text-ash">Applications</h2>
        <p className="mt-4 text-sm text-ash">No applications yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-caption text-ash">
        Applications ({initialApplications.length})
      </h2>

      <div className="mt-4 space-y-4">
        {initialApplications.map((app) => {
          const id = app.applicant_id;
          const status = statuses[id] ?? app.status;
          const isBusy = !!busy[id];
          const rowError = rowErrors[id];
          const isConfirming = confirm?.id === id;

          return (
            <div
              key={app.id}
              className="rounded-lg border border-bone bg-paper p-5 transition-colors hover:border-ink/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar
                    name={app.applicant.name}
                    src={app.applicant.avatar_url ?? undefined}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{app.applicant.name}</p>
                    <p className="truncate text-sm text-ash">
                      @{app.applicant.handle}
                      {app.applicant.college ? ` . ${app.applicant.college}` : ""}
                    </p>
                  </div>
                </div>

                <Tag
                  variant={
                    status === "accepted"
                      ? "moss"
                      : status === "rejected"
                      ? "outline"
                      : "saffron"
                  }
                >
                  {STATUS_LABEL[status]}
                </Tag>
              </div>

              <p className="mt-4 whitespace-pre-wrap break-words text-sm text-ink">
                {app.pitch}
              </p>

              {app.links.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                  {app.links.map((link) =>
                    /^https?:\/\//i.test(link) ? (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-xs text-saffron underline underline-offset-2 hover:text-saffron-dk"
                      >
                        {link}
                      </a>
                    ) : (
                      <span key={link} className="max-w-full truncate text-xs text-ash">
                        {link}
                      </span>
                    ),
                  )}
                </div>
              )}

              {/* Actions */}
              {isConfirming ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink">
                    {confirm?.kind === "remove"
                      ? "Remove this member from the team?"
                      : "Reject this applicant?"}
                  </span>
                  <Button
                    size="md"
                    variant="destructive"
                    onClick={runConfirm}
                    disabled={isBusy}
                  >
                    {confirm?.kind === "remove" ? "Yes, remove" : "Yes, reject"}
                  </Button>
                  <Button
                    size="md"
                    variant="ghost"
                    onClick={() => setConfirm(null)}
                    disabled={isBusy}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {status === "pending" && (
                    <>
                      <Button
                        size="md"
                        variant="primary"
                        onClick={() => handleAccept(id)}
                        disabled={isBusy}
                      >
                        Accept
                      </Button>
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={() => setConfirm({ id, kind: "reject" })}
                        disabled={isBusy}
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  {status === "accepted" && (
                    <Button
                      size="md"
                      variant="destructive"
                      onClick={() => setConfirm({ id, kind: "remove" })}
                      disabled={isBusy}
                    >
                      Remove from team
                    </Button>
                  )}

                  {status === "rejected" && (
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => handleUndo(id)}
                      disabled={isBusy}
                    >
                      Undo
                    </Button>
                  )}

                  <Button
                    size="md"
                    variant="ghost"
                    onClick={() => handleMessage(id)}
                    disabled={isBusy}
                  >
                    Message
                  </Button>
                </div>
              )}

              <div aria-live="polite">
                {rowError && <p className="mt-3 text-sm text-ember">{rowError}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
