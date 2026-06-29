"use client";

import { useTransition, useState } from "react";
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

interface ApplicationsPanelProps {
  projectId: string;
  shortId: string;
  applications: ApplicationRow[];
}

export function ApplicationsPanel({
  projectId,
  shortId,
  applications: initialApplications,
}: ApplicationsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<
    Record<string, "pending" | "accepted" | "rejected">
  >(() =>
    Object.fromEntries(initialApplications.map((a) => [a.applicant_id, a.status]))
  );
  const [actionError, setActionError] = useState<string | null>(null);

  function handleAccept(applicantId: string) {
    setStatuses((prev) => ({ ...prev, [applicantId]: "accepted" }));
    startTransition(async () => {
      const result = await acceptApplicantAction(projectId, applicantId, shortId);
      if (!result.ok) {
        setStatuses((prev) => ({ ...prev, [applicantId]: "pending" }));
        setActionError(result.error ?? "Failed to accept applicant.");
      }
    });
  }

  function handleReject(applicantId: string) {
    setStatuses((prev) => ({ ...prev, [applicantId]: "rejected" }));
    startTransition(async () => {
      const result = await rejectApplicantAction(projectId, applicantId, shortId);
      if (!result.ok) {
        setStatuses((prev) => ({ ...prev, [applicantId]: "pending" }));
        setActionError(result.error ?? "Failed to reject applicant.");
      }
    });
  }

  function handleMessage(applicantId: string) {
    startTransition(async () => {
      const result = await messageApplicantAction(applicantId);
      if (result.ok && result.conversationId) {
        router.push(`/messages/${result.conversationId}`);
      } else {
        setActionError(result.error ?? "Could not open conversation.");
      }
    });
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

      {actionError && (
        <p className="mt-2 text-sm text-ember">{actionError}</p>
      )}

      <div className="mt-4 space-y-4">
        {initialApplications.map((app) => {
          const status = statuses[app.applicant_id] ?? app.status;
          const isResolved = status === "accepted" || status === "rejected";

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
                      {app.applicant.college
                        ? ` . ${app.applicant.college}`
                        : ""}
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
                  {status}
                </Tag>
              </div>

              <p className="mt-4 line-clamp-3 break-words text-sm text-ink">
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
                      // Belt-and-suspenders: never render a non-http(s) link as a
                      // clickable anchor (guards against stored javascript: XSS).
                      <span
                        key={link}
                        className="max-w-full truncate text-xs text-ash"
                      >
                        {link}
                      </span>
                    )
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {!isResolved && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleAccept(app.applicant_id)}
                      disabled={pending}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleReject(app.applicant_id)}
                      disabled={pending}
                    >
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMessage(app.applicant_id)}
                  disabled={pending}
                >
                  Message
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
