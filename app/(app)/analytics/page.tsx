import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Avatar } from "@/components/primitives/Avatar";
import { StatCard } from "@/components/composite/analytics/StatCard";
import { MiniChart } from "@/components/composite/analytics/MiniChart";
import { getCreatorAnalytics } from "@/lib/db/analytics";
import { relativeTime } from "@/lib/ui/toCardPost";
import {
  BarChart3,
  Eye,
  TrendingUp,
  Users,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  FileText,
  Activity,
  Lock,
  Gauge,
} from "lucide-react";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("en-IN");
const fmt = (n: number) => nf.format(Math.round(n));
const pct = (rate: number) =>
  `${(rate * 100).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;

/** Compact rounded percentage for inline metrics (e.g. engagement rate column). */
function ratePct(rate: number): string {
  return `${(rate * 100).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

function truncate(body: string, max = 120): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean || "(no text)";
  return clean.slice(0, max).trimEnd() + "…";
}

export default async function AnalyticsPage() {
  const a = await getCreatorAnalytics();
  const t = a.totals;

  const impressionPoints = a.impressionsDaily.map((d) => ({
    day: d.day,
    value: d.impressions,
  }));
  const engagementPoints = a.engagementsDaily.map((d) => ({
    day: d.day,
    value: d.engagements,
  }));
  const enoughImpr = impressionPoints.length >= 2;
  const enoughEng = engagementPoints.length >= 2;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <Reveal>
        <div className="flex flex-col gap-3">
          <p className="text-caption text-ash">Creator analytics</p>
          <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
            Your analytics
          </h1>
          <p className="max-w-2xl text-ash">
            Real reach and engagement across everything you have shared.
          </p>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-bone px-3 py-1 text-xs font-medium text-ash">
            <Lock className="size-3" /> Only you can see this
          </span>
        </div>
      </Reveal>

      {/* Overview stat cards */}
      <Reveal delay={0.05}>
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard icon={Eye} label="Impressions" value={fmt(t.impressions)} />
          <StatCard
            icon={Activity}
            label="Engagements"
            value={fmt(t.engagements)}
          />
          <StatCard
            icon={TrendingUp}
            label="Engagement rate"
            value={pct(t.engagementRate)}
            secondary="weighted across all posts"
          />
          <StatCard icon={FileText} label="Posts" value={fmt(t.posts)} />
          <StatCard
            icon={Users}
            label="Followers"
            value={fmt(t.followers)}
            secondary={
              t.newFollowers30d > 0
                ? `+${fmt(t.newFollowers30d)} new in 30d`
                : "no new followers in 30d"
            }
            secondaryTone={t.newFollowers30d > 0 ? "moss" : "ash"}
          />
          <StatCard
            icon={Eye}
            label="Profile views"
            value={fmt(t.profileViews30d)}
            secondary={`${fmt(t.profileViewsTotal)} all time`}
          />
          <StatCard
            icon={Users}
            label="Connections"
            value={fmt(t.connections)}
          />
        </section>
      </Reveal>

      {/* Reach + engagement over time */}
      <Reveal delay={0.1}>
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-bone bg-paper p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-saffron" />
                <h2 className="font-serif text-lg text-ink">Reach over time</h2>
              </div>
              <span className="text-xs text-ash">Last 30 days</span>
            </div>
            {enoughImpr ? (
              <div className="mt-4">
                <MiniChart
                  points={impressionPoints}
                  color="saffron"
                  variant="area"
                  format={fmt}
                  ariaLabel="Daily impressions over the last 30 days"
                />
              </div>
            ) : (
              <EmptyChart label="Not enough data yet" />
            )}
          </div>

          <div className="rounded-xl border border-bone bg-paper p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-moss" />
                <h2 className="font-serif text-lg text-ink">
                  Engagements over time
                </h2>
              </div>
              <span className="text-xs text-ash">Last 30 days</span>
            </div>
            {enoughEng ? (
              <div className="mt-4">
                <MiniChart
                  points={engagementPoints}
                  color="moss"
                  variant="bars"
                  format={fmt}
                  ariaLabel="Daily engagements over the last 30 days"
                />
              </div>
            ) : (
              <EmptyChart label="Not enough data yet" />
            )}
          </div>
        </section>
      </Reveal>

      {/* Top posts */}
      <Reveal delay={0.15}>
        <section className="mt-8 rounded-xl border border-bone bg-paper">
          <div className="flex flex-col gap-1 border-b border-bone p-5">
            <h2 className="font-serif text-lg text-ink">Top posts</h2>
            <p className="text-xs text-ash">
              Ranked by impressions. &ldquo;Feed score&rdquo; is the exact
              Bayesian rate the ranking algorithm assigns each post
              (engagements ÷ (impressions + 20)) - it is how the feed itself
              sees your content.
            </p>
          </div>

          {a.topPosts.length === 0 ? (
            <div className="p-8 text-center text-sm text-ash">
              You have not shared anything yet. Your posts and their reach will
              appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Header row (desktop) */}
              <div className="hidden min-w-[760px] items-center gap-3 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ash md:flex">
                <span className="flex-1">Post</span>
                <span className="w-16 text-right">Impr.</span>
                <span className="w-12 text-right">Likes</span>
                <span className="w-12 text-right">Comm.</span>
                <span className="w-12 text-right">Rep.</span>
                <span className="w-12 text-right">Saves</span>
                <span className="w-16 text-right">Eng. rate</span>
                <span className="w-20 text-right">Feed score</span>
              </div>

              <ul className="divide-y divide-bone">
                {a.topPosts.map((p) => (
                  <li key={p.id}>
                    {/* Desktop row */}
                    <Link
                      href={`/p/${p.short_id}`}
                      className="hidden min-w-[760px] items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-cream md:flex"
                    >
                      <span className="flex-1 truncate text-ink">
                        {truncate(p.body, 80)}
                      </span>
                      <span className="w-16 text-right tabular-nums text-ink">
                        {fmt(p.impressions)}
                      </span>
                      <span className="w-12 text-right tabular-nums text-ash">
                        {fmt(p.likes)}
                      </span>
                      <span className="w-12 text-right tabular-nums text-ash">
                        {fmt(p.comments)}
                      </span>
                      <span className="w-12 text-right tabular-nums text-ash">
                        {fmt(p.reposts)}
                      </span>
                      <span className="w-12 text-right tabular-nums text-ash">
                        {fmt(p.saves)}
                      </span>
                      <span className="w-16 text-right tabular-nums text-ink">
                        {ratePct(p.engagementRate)}
                      </span>
                      <span className="w-20 text-right">
                        <span className="inline-flex items-center justify-end gap-1 rounded-full bg-saffron/10 px-2 py-0.5 text-xs font-medium tabular-nums text-saffron-dk">
                          <Gauge className="size-3" />
                          {p.rankerScore.toLocaleString("en-IN", {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })}
                        </span>
                      </span>
                    </Link>

                    {/* Mobile card */}
                    <Link
                      href={`/p/${p.short_id}`}
                      className="block px-4 py-3 transition-colors hover:bg-cream md:hidden"
                    >
                      <p className="line-clamp-2 text-sm text-ink">
                        {truncate(p.body, 120)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ash">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Eye className="size-3.5" /> {fmt(p.impressions)}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Heart className="size-3.5" /> {fmt(p.likes)}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <MessageCircle className="size-3.5" /> {fmt(p.comments)}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Repeat2 className="size-3.5" /> {fmt(p.reposts)}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Bookmark className="size-3.5" /> {fmt(p.saves)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="tabular-nums text-ink">
                          {ratePct(p.engagementRate)} eng. rate
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-saffron/10 px-2 py-0.5 font-medium tabular-nums text-saffron-dk">
                          <Gauge className="size-3" /> Feed{" "}
                          {p.rankerScore.toLocaleString("en-IN", {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </Reveal>

      {/* Who viewed your profile */}
      <Reveal delay={0.2}>
        <section className="mt-8 mb-4 rounded-xl border border-bone bg-paper p-5">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-saffron" />
            <h2 className="font-serif text-lg text-ink">
              Who viewed your profile
            </h2>
          </div>

          {a.recentViewers.length === 0 ? (
            <p className="mt-4 text-sm text-ash">No profile views yet.</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {a.recentViewers.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/u/${v.handle}`}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-bone hover:bg-cream"
                  >
                    <Avatar name={v.name} src={v.avatar_url ?? undefined} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {v.name}
                      </p>
                      {v.college ? (
                        <p className="truncate text-xs text-ash">{v.college}</p>
                      ) : (
                        <p className="truncate text-xs text-ash">@{v.handle}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-ash">
                      {relativeTime(v.viewed_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="mt-4 flex h-36 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-bone bg-cream/50 text-center">
      <BarChart3 className="size-5 text-ash" />
      <p className="text-sm text-ash">{label}</p>
      <p className="text-xs text-ash/70">
        Keep posting - this fills in as your reach is logged.
      </p>
    </div>
  );
}
