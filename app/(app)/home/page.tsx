import Link from "next/link";
import { PostComposer } from "@/components/composite/PostComposer";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import { HomeFeed } from "@/components/composite/HomeFeed";
import { getForYouFeed, getRecentFeed, getPopularFeed, getTrendingFeed } from "@/lib/db/feed";
import { getMyEngagementState } from "@/lib/db/engagement";
import { getSuggestedConnections } from "@/lib/db/social";
import { getMyProfile } from "@/lib/db/profiles";
import { getNewsForUser } from "@/lib/news/fetch";
import { toCardPost, relativeTime } from "@/lib/ui/toCardPost";
import { createPostAction } from "./actions";
import {
  Users,
  Briefcase,
  TrendingUp,
  ExternalLink,
  UserCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getMyProfile();
  const branch = profile?.branch ?? undefined;
  const city = profile?.city ?? undefined;

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

  const displayName = profile?.name ?? "You";
  const displayHandle = profile?.handle ?? "";
  const displayCollege = profile?.college ?? "";
  const displayBranch = profile?.branch ?? "";

  return (
    <div className="mx-auto max-w-7xl">
      {/* 3-column grid: left sidebar | center feed | right rail */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_280px] xl:grid-cols-[260px_1fr_300px]">

        {/* ------------------------------------------------------------------ */}
        {/* LEFT SIDEBAR - "You" mini-card + quick links                        */}
        {/* ------------------------------------------------------------------ */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">

            {/* Profile card */}
            <div className="overflow-hidden rounded-xl border border-bone bg-paper">
              {/* Cover strip */}
              <div className="h-14 bg-linear-to-br from-saffron/20 via-bone to-cream" />

              <div className="px-4 pb-4 -mt-6">
                <Link href="/profile" className="inline-block">
                  <Avatar
                    name={displayName}
                    src={profile?.avatar_url ?? undefined}
                    size="lg"
                    className="ring-2 ring-paper ring-offset-0 hover:ring-saffron/30 transition-all"
                  />
                </Link>

                <div className="mt-2">
                  <Link
                    href="/profile"
                    className="block text-sm font-semibold text-ink hover:text-saffron transition-colors leading-tight"
                  >
                    {displayName}
                  </Link>
                  {displayHandle ? (
                    <p className="text-xs text-ash mt-0.5">@{displayHandle}</p>
                  ) : null}
                  {(displayCollege || displayBranch) ? (
                    <p className="text-xs text-ash mt-1 leading-snug">
                      {[displayBranch, displayCollege].filter(Boolean).join(" - ")}
                    </p>
                  ) : null}
                </div>

                {/* Quick nav links */}
                <div className="mt-4 space-y-0.5">
                  <SidebarLink href="/profile" icon={<UserCheck className="size-3.5" />}>
                    Profile
                  </SidebarLink>
                  <SidebarLink href="/network" icon={<Users className="size-3.5" />}>
                    Network
                  </SidebarLink>
                  <SidebarLink href="/collabs" icon={<Briefcase className="size-3.5" />}>
                    Collabs
                  </SidebarLink>
                </div>
              </div>
            </div>

            {/* Interests tags */}
            {profile?.interests && profile.interests.length > 0 ? (
              <div className="rounded-xl border border-bone bg-paper px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ash mb-3">
                  Your interests
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.slice(0, 8).map((interest) => (
                    <Tag key={interest} variant="outline" className="text-[11px]">
                      {interest}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        {/* ------------------------------------------------------------------ */}
        {/* CENTER - Composer + tabs + feed                                     */}
        {/* ------------------------------------------------------------------ */}
        <div className="min-w-0">
          <Reveal>
            <div className="mb-0">
              <PostComposer action={createPostAction} />
            </div>
          </Reveal>

          <HomeFeed
            forYou={forYou}
            recent={recent}
            popular={popular}
            trending={trendingPosts}
            currentUserId={profile?.id ?? ""}
          />
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT RAIL - Trending + People + Daily brief                        */}
        {/* ------------------------------------------------------------------ */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">

            {/* Trending hashtags */}
            {trending.length > 0 ? (
              <Reveal>
                <section className="rounded-xl border border-bone bg-paper px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="size-3.5 text-saffron" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-ash">
                      Trending
                    </p>
                  </div>
                  <div className="space-y-2">
                    {trending.map((t) => (
                      <div key={t.tag} className="flex items-center justify-between gap-2 group">
                        <span className="text-sm font-medium text-ink group-hover:text-saffron transition-colors truncate">
                          #{t.tag}
                        </span>
                        <span className="text-xs text-ash tabular-nums shrink-0">{t.count} posts</span>
                      </div>
                    ))}
                  </div>
                </section>
              </Reveal>
            ) : null}

            {/* People to follow */}
            {suggested.length > 0 ? (
              <Reveal delay={0.08}>
                <section className="rounded-xl border border-bone bg-paper px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ash mb-3">
                    People to follow
                  </p>
                  <div className="space-y-3">
                    {suggested.map((p) => (
                      <Link
                        key={p.id}
                        href={`/u/${p.handle}`}
                        className="flex items-center gap-2.5 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-bone/50 group"
                      >
                        <Avatar
                          name={p.name}
                          src={p.avatar_url ?? undefined}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink group-hover:text-saffron transition-colors">
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
              </Reveal>
            ) : null}

            {/* Daily brief */}
            {brief ? (
              <Reveal delay={0.15}>
                <section className="rounded-xl border border-bone bg-paper px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ash mb-3">
                    Daily brief
                  </p>
                  <a
                    href={brief.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-saffron">
                        {brief.source}
                      </span>
                      <span className="text-bone select-none">&middot;</span>
                      <span className="text-xs text-ash">{relativeTime(brief.published_at)}</span>
                    </div>
                    <h3
                      className="text-sm font-medium leading-snug text-ink group-hover:text-saffron transition-colors"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {brief.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-1 text-xs text-ash group-hover:text-saffron transition-colors">
                      <ExternalLink className="size-3" />
                      <span>Read more</span>
                    </div>
                  </a>
                </section>
              </Reveal>
            ) : null}

          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left sidebar link
// ---------------------------------------------------------------------------

function SidebarLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-ash transition-colors hover:bg-bone hover:text-ink"
    >
      <span className="shrink-0 text-ash">{icon}</span>
      {children}
    </Link>
  );
}
