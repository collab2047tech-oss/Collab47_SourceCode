import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Tag } from "@/components/primitives/Tag";
import { Button } from "@/components/primitives/Button";
import { getModerationQueue } from "@/lib/db/reports";
import { getSupabaseServer } from "@/lib/supabase/server";
import { resolveReportAction } from "@/app/(app)/home/report-actions";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export const dynamic = "force-dynamic";

export default async function ModerationQueuePage() {
  const items = await getModerationQueue(50);

  // The moderation_queue view only exposes the post UUID, but /p/[short_id]
  // routes by short_id - linking the UUID 404s every post. Resolve short_ids
  // server-side. Only viewable (non-deleted) posts resolve; an unresolved link
  // is hidden rather than pointed at a page that would 404 anyway.
  const postIds = Array.from(
    new Set(items.map((it) => it.post_id).filter((id): id is string => !!id))
  );
  const shortIdByPostId = new Map<string, string>();
  if (postIds.length > 0) {
    const sb = await getSupabaseServer();
    if (sb) {
      const { data: postRows } = await sb
        .from("posts")
        .select("id, short_id")
        .in("id", postIds);
      for (const row of (postRows ?? []) as Array<{
        id: string;
        short_id: string | null;
      }>) {
        if (row.short_id) shortIdByPostId.set(row.id, row.short_id);
      }
    }
  }

  async function dismiss(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString() ?? "";
    if (id) await resolveReportAction(id, "dismiss");
  }
  async function remove(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString() ?? "";
    if (id) await resolveReportAction(id, "remove_post");
  }
  async function suspend(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString() ?? "";
    if (id) await resolveReportAction(id, "suspend_user");
  }

  return (
    <main className="container-edit max-w-5xl py-20">
      <Reveal>
        <div className="rule-top">
          <p className="text-caption">Admin</p>
          <h1 className="mt-4 font-serif text-5xl text-ink">
            Founder review queue. <span className="italic text-saffron">Decide.</span>
          </h1>
          <p className="mt-3 text-body text-ash">
            Three or more flags trigger auto-hide. Review within 24 hours.
          </p>
          <p className="mt-4">
            <Link href="/feedback" className="text-sm text-saffron underline underline-offset-4">
              Go to feedback inbox
            </Link>
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <ul className="mt-12 space-y-6">
          {items.length === 0 ? (
            <li className="rounded-lg border border-bone bg-paper p-12 text-center text-ash">
              All clear. No open reports.
            </li>
          ) : (
            items.map((it) => (
              <li key={it.id} className="rounded-lg border border-bone bg-paper p-6">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Tag variant={it.category === "spam" ? "outline" : it.category === "sexual" ? "saffron" : "moss"}>
                      {it.category}
                    </Tag>
                    <span className="text-caption">{it.report_total} reports</span>
                  </div>
                  <span className="text-caption">{relativeTime(it.reported_at)}</span>
                </header>

                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-ash">
                    Reporter: <span className="text-ink">@{it.reporter_handle ?? "anonymous"}</span>
                  </p>
                  {it.report_body ? (
                    <p className="rounded-md border border-bone bg-cream p-3 text-sm italic text-ash">
                      "{it.report_body}"
                    </p>
                  ) : null}
                </div>

                {it.post_id ? (
                  <div className="mt-4 rounded-md border border-bone bg-cream p-3">
                    <p className="text-caption">Post by @{it.target_handle}</p>
                    <p className="mt-2 line-clamp-4 text-sm text-ink">{it.post_body}</p>
                    {it.post_id && shortIdByPostId.get(it.post_id) ? (
                      <Link
                        href={`/p/${shortIdByPostId.get(it.post_id)}`}
                        className="mt-2 inline-block text-xs text-saffron underline"
                      >
                        Open post
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-bone bg-cream p-3">
                    <p className="text-caption">Profile @{it.target_handle}</p>
                    <Link href={`/u/${it.target_handle}`} className="mt-2 inline-block text-xs text-saffron underline">
                      Open profile
                    </Link>
                  </div>
                )}

                <footer className="mt-5 flex flex-wrap gap-2">
                  <form action={dismiss}>
                    <input type="hidden" name="id" value={it.id} />
                    <Button type="submit" variant="ghost" size="sm">Dismiss</Button>
                  </form>
                  {it.post_id ? (
                    <form action={remove}>
                      <input type="hidden" name="id" value={it.id} />
                      <Button type="submit" variant="secondary" size="sm">Remove post</Button>
                    </form>
                  ) : null}
                  <form action={suspend}>
                    <input type="hidden" name="id" value={it.id} />
                    <Button type="submit" variant="destructive" size="sm">Suspend user</Button>
                  </form>
                </footer>
              </li>
            ))
          )}
        </ul>
      </Reveal>
    </main>
  );
}
