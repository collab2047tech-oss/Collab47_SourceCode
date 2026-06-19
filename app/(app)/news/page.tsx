/**
 * /news - InShorts-style card reader (server component).
 * Items are ordered purely by recency; the client personalises + loops.
 */

import { getNewsForUser } from "@/lib/news/fetch";
import type { NewsItem } from "@/lib/supabase/types";
import { InShortsFeed } from "@/components/composite/InShortsFeed";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const items: NewsItem[] = await getNewsForUser(undefined, undefined, 500);

  return <InShortsFeed items={items} />;
}
