import { getMyConversations } from "@/lib/db/messages";
import { Avatar } from "@/components/primitives/Avatar";
import { Reveal } from "@/components/motion/Reveal";
import { AcceptRequestButton } from "@/components/composite/AcceptRequestButton";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default async function RequestsPage() {
  const requests = await getMyConversations("requests");

  return (
    <div className="-mx-4 -mt-6 grid h-[calc(100dvh-4rem)] grid-cols-[340px_1fr] md:-mx-8">
      {/* Left rail */}
      <aside className="flex flex-col border-r border-bone bg-paper">
        <div className="p-5">
          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              className="text-sm text-ash transition-colors hover:text-ink"
            >
              Inbox
            </Link>
            <span className="text-ash">/</span>
            <span className="text-sm font-semibold text-ink">Requests</span>
          </div>
          <h2 className="mt-3 font-serif text-2xl text-ink">Message Requests</h2>
          <p className="mt-1 text-sm text-ash">
            Messages from people you do not follow yet.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {requests.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <MessageSquare className="size-8 text-bone" />
              <p className="text-sm text-ash">No message requests.</p>
            </div>
          )}
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex w-full items-start gap-3 border-b border-bone px-5 py-4 last:border-0"
            >
              <Avatar
                name={req.otherUser.name}
                src={req.otherUser.avatar_url ?? undefined}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">
                    {req.otherUser.name}
                  </p>
                  <p className="shrink-0 text-xs text-ash">
                    {relativeTime(req.lastMessageAt)}
                  </p>
                </div>
                {req.otherUser.college && (
                  <p className="text-xs text-ash">{req.otherUser.college}</p>
                )}
                <p className="mt-1 truncate text-sm text-ash">{req.lastMessage}</p>
                <div className="mt-3 flex gap-2">
                  <AcceptRequestButton conversationId={req.id} />
                  <Link
                    href={`/messages/${req.id}`}
                    className="rounded-md border border-bone px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-bone"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right pane placeholder */}
      <section className="flex flex-col items-center justify-center gap-3 bg-cream">
        <Reveal>
          <div className="text-center">
            <MessageSquare className="mx-auto size-10 text-bone" />
            <p className="mt-2 text-sm text-ash">Select a request to preview the conversation.</p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
