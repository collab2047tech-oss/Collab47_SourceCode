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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-caption">Inbox</p>
              <h1 className="mt-4 font-serif text-5xl text-ink">
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
        <ul className="mt-12 divide-y divide-bone">
          {items.length === 0 ? (
            <li className="py-12 text-center text-ash">Nothing yet. Make a post.</li>
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
      </Reveal>
    </div>
  );
}
