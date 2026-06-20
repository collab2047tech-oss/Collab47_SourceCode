import { Reveal } from "@/components/motion/Reveal";
import {
  Heart, MessageCircle, MessageSquare, CornerDownRight, UserPlus, UserCheck,
  Briefcase, Bell, AtSign, Repeat2, Bookmark, Mail,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { MarkAllReadButton } from "@/components/composite/MarkAllReadButton";
import {
  NotificationItem,
  type NotificationItemData,
} from "@/components/composite/NotificationItem";

const KIND_ICON: Record<string, React.ElementType> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageCircle,
  comment_reply: CornerDownRight,
  repost: Repeat2,
  bookmark: Bookmark,
  mention: AtSign,
  connection_request: UserCheck,
  dm: Mail,
  dm_request: MessageSquare,
  project_invite: Briefcase,
  project_accepted: Briefcase,
  system: Bell,
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const sb = await getSupabaseServer();
  let items: NotificationItemData[] = [];

  if (sb) {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data } = await sb
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      items = (data ?? []).map((n) => ({
        id: n.id,
        kind: n.kind,
        text: typeof n.payload === "object" && n.payload && "text" in n.payload ? String(n.payload.text) : "",
        who: typeof n.payload === "object" && n.payload && "who" in n.payload ? String(n.payload.who) : "Someone",
        when: new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }),
        href: typeof n.payload === "object" && n.payload && "href" in n.payload ? String(n.payload.href) : "/home",
        unread: n.read_at === null,
      }));
    }
  }

  const hasUnread = items.some((n) => n.unread);

  return (
    <div className="mx-auto max-w-2xl">
      <Reveal>
        <div className="rule-top">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-caption">Inbox</p>
                {hasUnread && (
                  <span className="inline-flex items-center rounded-full bg-saffron/10 px-2 py-0.5 text-[10px] font-semibold text-saffron">
                    {items.filter((n) => n.unread).length} new
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-serif text-4xl leading-tight text-ink sm:mt-4 sm:text-5xl">
                Activity. <span className="italic text-saffron">All in one place.</span>
              </h1>
            </div>
            <div className="shrink-0 pt-1">
              <MarkAllReadButton hasUnread={hasUnread} />
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <ul className="mt-8 divide-y divide-bone sm:mt-12">
          {items.length === 0 ? (
            <li className="flex flex-col items-center gap-2 py-16 text-center">
              <span className="flex size-14 items-center justify-center rounded-full border border-bone bg-paper">
                <Bell className="size-6 text-ash" />
              </span>
              <p className="text-ash">Nothing yet. Make a post.</p>
            </li>
          ) : (
            items.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <NotificationItem
                    item={n}
                    icon={<Icon className="size-4 text-ink" />}
                  />
                </li>
              );
            })
          )}
        </ul>
        {items.length > 0 && (
          <p className="mt-8 text-center text-caption">
            {items.length} {items.length === 1 ? "notification" : "notifications"} · last 50
          </p>
        )}
      </Reveal>
    </div>
  );
}
