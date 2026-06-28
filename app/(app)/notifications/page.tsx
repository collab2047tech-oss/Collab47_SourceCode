import { Reveal } from "@/components/motion/Reveal";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/composite/NotificationsList";
import type { NotificationItemData } from "@/components/composite/NotificationItem";

export const dynamic = "force-dynamic";

interface RawPayload {
  text?: unknown;
  who?: unknown;
  href?: unknown;
}

export default async function NotificationsPage() {
  const sb = await getSupabaseServer();
  let items: NotificationItemData[] = [];
  let userId: string | null = null;

  if (sb) {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      userId = user.id;
      const { data } = await sb
        .from("notifications")
        .select("id, kind, payload, created_at, read_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      items = (data ?? []).map((n) => {
        const p = (n.payload ?? {}) as RawPayload;
        return {
          id: n.id as string,
          kind: n.kind as string,
          // Pass the RAW ISO timestamp through; relative + absolute time are
          // computed client-side in the viewer's locale (fixes the UTC bug).
          createdAt: n.created_at as string,
          message: typeof p.text === "string" ? p.text : "New activity",
          who: typeof p.who === "string" ? p.who : "Someone",
          href: typeof p.href === "string" ? p.href : "/home",
          unread: n.read_at === null,
        };
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Reveal>
        <div className="rule-top">
          <p className="text-caption">Notifications</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-ink sm:mt-4 sm:text-5xl">
            Activity. <span className="italic text-saffron">All in one place.</span>
          </h1>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <NotificationsList initialItems={items} userId={userId} />
      </Reveal>
    </div>
  );
}
