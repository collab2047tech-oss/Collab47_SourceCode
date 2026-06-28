import Link from "next/link";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import { FeedClient } from "@/components/composite/FeedClient";
import { NewsRail } from "@/components/composite/NewsRail";
import { SuggestedFollowRow } from "@/components/composite/SuggestedFollowRow";
import { getFeedPage, recentIsDiscovery, type FeedPrefs } from "@/lib/db/feed";
import { getSuggestedPeople, getRelationshipStates } from "@/lib/db/social";
import { getMyProfile } from "@/lib/db/profiles";
import { getRankedNewsForUser } from "@/lib/news/fetch";
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
  const [foryouPage, isRecentDiscovery, suggested, news] = await Promise.all([
    getFeedPage("foryou", { prefs, limit: 12 }),
    recentIsDiscovery(),
    getSuggestedPeople(5),
    getRankedNewsForUser(6),
  ]);

  // Follow state for the rail people so the optimistic Follow button starts in
  // the correct state instead of always reading "Follow". This and the card
  // hydration both depend only on the first batch above and are independent of
  // each other, so run them concurrently instead of serially.
  const [suggestedRel, forYou] = await Promise.all([
    getRelationshipStates(suggested.map((p) => p.id)),
    toCardsWithEng(foryouPage.posts),
  ]);

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

  const interests = profile?.interests ?? [];

  // ---------------------------------------------------------------------------
  // Right-rail building blocks. Defined once, reused in the desktop rail and the
  // slimmed mobile rail below the feed (no overflow at 360px).
  // ---------------------------------------------------------------------------

  const trendingCard =
    trending.length > 0 ? (
      <section className="card card-hover px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-3.5 text-saffron" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ash">Trending</p>
        </div>
        <div className="space-y-1">
          {trending.map((t) => (
            <Link
              key={t.tag}
              href={`/explore?q=%23${encodeURIComponent(t.tag)}`}
              className="group -mx-1.5 flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-bone/50"
            >
              <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-ink transition-colors group-hover:text-saffron">
                <Hash className="size-3 shrink-0 text-ash transition-colors group-hover:text-saffron" />
                <span className="truncate">{t.tag}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ash">{t.count} posts</span>
            </Link>
          ))}
        </div>
      </section>
    ) : null;

  const peopleCard =
    suggested.length > 0 ? (
      <section className="card card-hover px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ash">
            People to follow
          </p>
          <Link href="/network" className="text-[11px] font-medium text-saffron hover:text-saffron-dk transition-colors">
            See all
          </Link>
        </div>
        <div className="space-y-1">
          {suggested.map((p) => (
            <SuggestedFollowRow
              key={p.id}
              id={p.id}
              name={p.name}
              handle={p.handle}
              avatarUrl={p.avatar_url}
              subtitle={[p.branch, p.college].filter(Boolean).join(" - ") || null}
              initialFollowing={suggestedRel[p.id]?.isFollowing ?? false}
            />
          ))}
        </div>
      </section>
    ) : null;

  const interestsCard =
    interests.length > 0 ? (
      <section className="card card-hover px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-3.5 text-saffron" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ash">
            Your interests
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {interests.slice(0, 10).map((interest) => (
            <Link key={interest} href={`/explore?q=${encodeURIComponent(interest)}`}>
              <Tag
                variant="outline"
                className="text-[11px] transition-colors hover:border-saffron/40 hover:text-saffron"
              >
                {interest}
              </Tag>
            </Link>
          ))}
        </div>
      </section>
    ) : null;

  // Daily brief - the full viewer-ranked news rail (internal /news/[id] links,
  // Save / discuss / share on each story). Fetched once above, shared by the
  // desktop rail and the slimmed mobile rail.
  const briefCard = news.length > 0 ? <NewsRail items={news} /> : null;

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

          {/* Mobile-only slimmed rail below the feed. Keeps the most useful
              discovery surfaces (People + Daily brief) without clutter. */}
          {(peopleCard || briefCard) ? (
            <div className="mt-6 space-y-4 lg:hidden">
              <Reveal>
                <div className="space-y-4">
                  {peopleCard}
                  {briefCard}
                </div>
              </Reveal>
            </div>
          ) : null}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT RAIL - Trending + People + Interests + Daily brief         */}
        {/* Sticky + self-scrolling so it stays visible as the infinite      */}
        {/* feed grows, and never traps the page scroll.                     */}
        {/* ---------------------------------------------------------------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto no-scrollbar pb-6">
            {trendingCard ? <Reveal>{trendingCard}</Reveal> : null}
            {peopleCard ? <Reveal delay={0.06}>{peopleCard}</Reveal> : null}
            {interestsCard ? <Reveal delay={0.12}>{interestsCard}</Reveal> : null}
            {briefCard ? <Reveal delay={0.18}>{briefCard}</Reveal> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
