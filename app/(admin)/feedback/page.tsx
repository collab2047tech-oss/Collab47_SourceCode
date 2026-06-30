import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Avatar } from "@/components/primitives/Avatar";
import { relativeTime } from "@/lib/ui/toCardPost";
import { listFeedback, feedbackCounts, type FeedbackKind, type FeedbackStatus } from "@/lib/db/feedback";
import { FeedbackTriage } from "./FeedbackTriage";

export const dynamic = "force-dynamic";

const KIND_STYLE: Record<FeedbackKind, { label: string; cls: string }> = {
  bug: { label: "Bug", cls: "bg-ember/10 text-ember" },
  feature: { label: "Feature", cls: "bg-saffron/10 text-saffron-dk" },
  other: { label: "Other", cls: "bg-bone text-ash" },
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

const TABS: { key: string; label: string; status?: FeedbackStatus }[] = [
  { key: "open", label: "Open", status: "open" },
  { key: "in_progress", label: "In progress", status: "in_progress" },
  { key: "resolved", label: "Resolved", status: "resolved" },
  { key: "all", label: "All" },
];

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const activeTab = TABS.find((t) => t.key === rawStatus) ?? TABS[0];

  const [items, counts] = await Promise.all([
    listFeedback(activeTab.status),
    feedbackCounts(),
  ]);

  return (
    <main className="container-edit max-w-5xl py-20">
      <Reveal>
        <div className="rule-top">
          <p className="text-caption">Admin</p>
          <h1 className="mt-4 font-serif text-5xl text-ink">
            Feedback. <span className="italic text-saffron">Triage.</span>
          </h1>
          <p className="mt-3 text-body text-ash">
            {counts.open} open / {counts.total} total. Bug reports, feature requests, and notes from the field.
          </p>
          <p className="mt-4">
            <Link href="/queue" className="text-sm text-saffron underline underline-offset-4">
              Go to review queue
            </Link>
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <nav className="mt-10 flex flex-wrap gap-2" aria-label="Filter by status">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab.key;
            return (
              <Link
                key={tab.key}
                href={tab.status ? `/feedback?status=${tab.key}` : "/feedback?status=all"}
                aria-current={isActive ? "page" : undefined}
                className={
                  "inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition-all duration-200 ease-out-soft " +
                  (isActive
                    ? "border-ink bg-ink text-cream"
                    : "border-bone bg-paper text-ash hover:border-ink hover:text-ink")
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </Reveal>

      <Reveal delay={0.1}>
        <ul className="mt-8 space-y-6">
          {items.length === 0 ? (
            <li className="rounded-lg border border-bone bg-paper p-12 text-center text-ash">
              {activeTab.status === "open"
                ? "Nothing in the inbox. No open feedback."
                : `No ${activeTab.label.toLowerCase()} feedback yet.`}
            </li>
          ) : (
            items.map((it) => {
              const kind = KIND_STYLE[it.kind] ?? KIND_STYLE.other;
              return (
                <li key={it.id} className="rounded-lg border border-bone bg-paper p-6">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide " +
                          kind.cls
                        }
                      >
                        {kind.label}
                      </span>
                      <span className="text-caption">{STATUS_LABEL[it.status]}</span>
                    </div>
                    <span className="text-caption">{relativeTime(it.created_at)}</span>
                  </header>

                  <h2 className="mt-4 font-serif text-2xl text-ink">{it.subject}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-ash">{it.body}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    {it.user_id && it.author ? (
                      <Link
                        href={`/u/${it.author.handle}`}
                        className="flex items-center gap-2 text-sm text-ink hover:text-saffron"
                      >
                        <Avatar name={it.author.name} src={it.author.avatar_url} size="sm" />
                        <span className="font-medium">{it.author.name}</span>
                        <span className="text-ash">@{it.author.handle}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-ash">
                        <Avatar name="Anonymous" size="sm" />
                        <span>Anonymous</span>
                      </div>
                    )}

                    {it.page_url ? (
                      <span className="text-caption">
                        from <span className="text-ash">{it.page_url}</span>
                      </span>
                    ) : null}
                  </div>

                  <footer className="mt-5 border-t border-bone pt-4">
                    <FeedbackTriage id={it.id} status={it.status} />
                  </footer>
                </li>
              );
            })
          )}
        </ul>
      </Reveal>
    </main>
  );
}
