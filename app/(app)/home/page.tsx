import Link from "next/link";
import { PostComposer } from "@/components/composite/PostComposer";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import { HomeFeed } from "@/components/composite/HomeFeed";
import { FeedFilters } from "@/components/composite/FeedFilters";
import { getForYouFeed, getRecentFeed, getPopularFeed, getTrendingFeed } from "@/lib/db/feed";
import { getMyEngagementState } from "@/lib/db/engagement";
import { getSuggestedConnections } from "@/lib/db/social";
import { getMyProfile } from "@/lib/db/profiles";
import { getNewsForUser } from "@/lib/news/fetch";
import { toCardPost, relativeTime } from "@/lib/ui/toCardPost";
import { createPostAction } from "./actions";
import {
  TrendingUp,
  ExternalLink,
  Sparkles,
  Hash,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getMyProfile();
  const branch = profile?.branch ?? undefined;
  const city = profile?.city ?? undefined;
  const feedPrefs =
    (profile?.feed_prefs as { only_follows?: boolean; hide_news?: boolean; hide_projects?: boolean } | null) ?? null;

  const [forYouRaw, recentRaw, popularRaw, trendingRaw, suggested, branchNews, latestNews] =
    await Promise.all([
      getForYouFeed(20),
      getRecentFeed(20),
      getPopularFeed(20),
      getTrendingFeed(20),
      getSuggestedConnections(5),
      getNewsForUser(branch, city, 12),
      getNewsForUser(undefined, undefined, 15),
    ]);

  const newsRaw = branchNews.length > 0 ? branchNews : latestNews;

  const allIds = [
    ...new Set([...forYouRaw, ...recentRaw, ...popularRaw, ...trendingRaw].map((p) => p.id)),
  ];
  const eng = await getMyEngagementState(allIds);
  const withEng = (p: (typeof forYouRaw)[number]) => {
    const card = toCardPost(p);
    card.liked = eng.likes.has(p.id);
    card.saved = eng.bookmarks.has(p.id);
    card.reaction = eng.reactions.get(p.id);
    return card;
  };

  const forYou = forYouRaw.map(withEng);
  const recent = recentRaw.map(withEng);
  const popular = popularRaw.map(withEng);
  const trendingPosts = trendingRaw.map(withEng);

  // Trending hashtags from the live "for you" pool
  const counts = new Map<string, number>();
  for (const p of forYouRaw) {
    for (const t of p.hashtags ?? []) {
      const tag = t.toLowerCase();
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const trending = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }));

  const brief = newsRaw[0] ?? null;
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
            <Link
              key={p.id}
              href={`/u/${p.handle}`}
              className="group -mx-1.5 flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-bone/50"
            >
              <Avatar name={p.name} src={p.avatar_url ?? undefined} size="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink transition-colors group-hover:text-saffron">
                  {p.name}
                </p>
                <p className="truncate text-xs text-ash">
                  {[p.branch, p.college].filter(Boolean).join(" - ")}
                </p>
              </div>
            </Link>
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

  const briefCard = brief ? (
    <section className="card card-hover px-4 py-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ash">Daily brief</p>
      <a href={brief.url} target="_blank" rel="noopener noreferrer" className="group block">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-saffron">
            {brief.source}
          </span>
          <span className="select-none text-bone">&middot;</span>
          <span className="text-xs text-ash">{relativeTime(brief.published_at)}</span>
        </div>
        <h3
          className="text-sm font-medium leading-snug text-ink transition-colors group-hover:text-saffron"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {brief.title}
        </h3>
        <div className="mt-2 flex items-center gap-1 text-xs text-ash transition-colors group-hover:text-saffron">
          <ExternalLink className="size-3" />
          <span>Read more</span>
        </div>
      </a>
    </section>
  ) : null;

  return (
    <div className="mx-auto max-w-270">
      {/* Centered two-column layout on lg+: [feed 1fr | right rail 320px].
          Single column on mobile (feed first, slimmed rail below). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* ---------------------------------------------------------------- */}
        {/* CENTER — composer + tabs + feed                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-w-0">
          <Reveal>
            <div id="composer" className="scroll-mt-24">
              <PostComposer action={createPostAction} />
            </div>
          </Reveal>

          <FeedFilters
            initial={{
              only_follows: Boolean(feedPrefs?.only_follows),
              hide_news: Boolean(feedPrefs?.hide_news),
              hide_projects: Boolean(feedPrefs?.hide_projects),
            }}
          />

          <HomeFeed
            forYou={forYou}
            recent={recent}
            popular={popular}
            trending={trendingPosts}
            currentUserId={profile?.id ?? ""}
          />

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
        {/* RIGHT RAIL — Trending + People + Interests + Daily brief         */}
        {/* ---------------------------------------------------------------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
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
