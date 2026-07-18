/**
 * /news - InShorts-style card reader (server component).
 *
 * Items are field-matched to the signed-in viewer by the classical engine
 * (`getRankedNewsForUser` -> recall recent -> score -> diversify). The client
 * loop re-shuffles WITHIN that already-relevant set as an instant
 * personalisation layer on top.
 */

import type { Metadata } from "next";
import { getRankedNewsForUser } from "@/lib/news/fetch";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { NewsItem } from "@/lib/supabase/types";
import { InShortsFeed } from "@/components/composite/InShortsFeed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News",
  description:
    "The latest academia and industry news, curated for India's students, researchers, faculty, and builders. Fresh stories, updated daily on Collab47.",
  alternates: { canonical: "/news" },
  openGraph: {
    type: "website",
    url: "/news",
    title: "News on Collab47",
    description:
      "The latest academia and industry news, curated for India's students, researchers, faculty, and builders.",
  },
};

export default async function NewsPage() {
  const items: NewsItem[] = await getRankedNewsForUser(300);

  // Pre-resolve which of these the viewer has saved so the bookmark renders
  // correctly on first paint (no flash).
  let savedIds: string[] = [];
  const sb = await getSupabaseServer();
  if (sb && items.length > 0) {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data } = await sb
        .from("news_saves")
        .select("news_id")
        .eq("user_id", user.id)
        .in("news_id", items.map((i) => i.id));
      savedIds = (data ?? []).map((r) => r.news_id as string);
    }
  }

  return <InShortsFeed items={items} savedIds={savedIds} />;
}
