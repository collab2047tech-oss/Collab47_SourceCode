import Link from "next/link";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import { FeedClient } from "@/components/composite/FeedClient";
import { getFeedPage, recentIsDiscovery, type FeedPrefs } from "@/lib/db/feed";
import { getMyProfile } from "@/lib/db/profiles";
import { toCardsWithEng } from "@/lib/ui/withEng";
import { createPostAction } from "./actions";
import {
  TrendingUp,
  Sparkles,
  Hash,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getMyProfile();
  const rawPrefs =
    (profile?.feed_prefs as { only_follows?: boolean; hide_projects?: boolean } | null) ?? null;
  const prefs: FeedPrefs = {
    only_follows: Boolean(rawPrefs?.only_follows),
    hide_projects: Boolean(rawPrefs?.hide_projects),
  };

  // Only the DEFAULT tab (For you) is fetched server-side. The other tabs lazy-
  // load their first page on first activation. This cuts first-paint work ~4x
  // versus the old eager 4-feed fetch.
  const [foryouPage, isRecentDiscovery] = await Promise.all([
    getFeedPage("foryou", { prefs, limit: 12 }),
    recentIsDiscovery(),
  ]);

  // Follow state for the rail people so the optimistic Follow button starts in
  // the correct state instead of always reading "Follow". This and the card
  // hydration both depend only on the first batch above and are independent of
  // each other, so run them concurrently instead of serially.
  const forYou = await toCardsWithEng(foryouPage.posts);

  // Trending hashtags from the live "for you" pool (also feeds composer tags).
  const counts = new Map<string, number>();
  for (const p of foryouPage.posts) {
    for (const t of p.hashtags ?? []) {
      const tag = t.toLowerCase();
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const trending = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }));


  return (
    <div className="mx-auto max-w-270">
      {/* Centered two-column layout on lg+: [feed 1fr | right rail 320px].
          Single column on mobile (feed first, slimmed rail below). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* ---------------------------------------------------------------- */}
        {/* CENTER - composer + filters + tabs + feed (one client island)    */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-w-0">
          <Reveal>
            <FeedClient
              initialForYou={{ posts: forYou, nextCursor: foryouPage.nextCursor }}
              recentIsDiscovery={isRecentDiscovery}
              initialPrefs={prefs}
              currentUserId={profile?.id ?? ""}
              me={{
                name: profile?.name ?? "You",
                handle: profile?.handle ?? "",
                avatar_url: profile?.avatar_url ?? null,
              }}
              suggestedTags={trending.map((t) => t.tag)}
              createAction={createPostAction}
            />
          </Reveal>

        </div>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT RAIL - reserved for advertising.                          */}
        {/* Intentionally empty: the 320px grid column is kept so the feed  */}
        {/* column keeps its exact width and the sticky tab bar in          */}
        {/* HomeFeed (lg:mx-0) keeps behaving correctly.                    */}
        {/* ---------------------------------------------------------------- */}
        <aside className="hidden lg:block" aria-hidden="true">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar pb-6" />
        </aside>
      </div>
    </div>
  );
}
