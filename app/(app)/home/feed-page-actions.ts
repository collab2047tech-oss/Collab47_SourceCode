"use server";

import { getFeedPage, type FeedTab, type FeedPrefs } from "@/lib/db/feed";
import { toCardsWithEng } from "@/lib/ui/withEng";
import type { Post as CardPost } from "@/components/composite/PostCard";

export interface FeedPageResult {
  posts: CardPost[];
  nextCursor: string | null;
}

/**
 * Load the next page of a feed tab. Returns ready-to-render CardPosts (with the
 * viewer's like/save/reaction state already overlaid) plus the next cursor.
 *  - foryou: pass the ids already on screen so the next page is fresh + deduped.
 *  - recent: cursor is the last row's created_at.
 *  - popular/trending: cursor is an opaque ranked-array offset.
 */
export async function loadFeedPageAction(
  tab: FeedTab,
  cursor: string | null,
  excludeIds: string[],
  prefs: FeedPrefs
): Promise<FeedPageResult> {
  const page = await getFeedPage(tab, { cursor, excludeIds, prefs, limit: 12 });
  const posts = await toCardsWithEng(page.posts);
  return { posts, nextCursor: page.nextCursor };
}
