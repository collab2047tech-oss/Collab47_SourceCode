import Link from "next/link";
import { TrendingUp, ArrowUp, ChevronRight } from "lucide-react";
import type { TrendingTag } from "@/lib/db/social";

interface TrendingTagsProps {
  tags: TrendingTag[];
  /** "rail" = slim home/sidebar list; "card" = explore editorial numbered list. */
  variant?: "rail" | "card";
  title?: string;
}

/**
 * One world-class Trending UI, driven by the single real source of truth
 * (getTrendingTags). Honest in-window post counts, a velocity "Rising"
 * affordance, and an "In your field" badge for personalised tags. All chips use
 * AA-passing tokens (ink/ash on paper, moss for rising, saffron-dk for field).
 * Every row links to the canonical /t/[tag].
 */
export function TrendingTags({ tags, variant = "card", title = "Trending" }: TrendingTagsProps) {
  if (tags.length === 0) {
    return (
      <p className="text-sm text-ash">
        No trends yet. Post something with a #hashtag to start one.
      </p>
    );
  }

  if (variant === "rail") {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-3.5 text-saffron" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ash">{title}</p>
        </div>
        <div className="space-y-0.5">
          {tags.map((t) => (
            <Link
              key={t.tag}
              href={`/t/${t.tag}`}
              className="group -mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-bone/50"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-ink transition-colors group-hover:text-saffron">
                    #{t.tag}
                  </span>
                  {t.rising ? <ArrowUp className="size-3 shrink-0 text-moss" /> : null}
                  {t.forYou ? (
                    <span className="shrink-0 rounded-full bg-saffron/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-saffron-dk">
                      Your field
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs text-ash tabular-nums">
                  {metaLine(t)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // card variant
  return (
    <ul className="space-y-1">
      {tags.map((t, i) => (
        <li key={t.tag}>
          <Link
            href={`/t/${t.tag}`}
            className="group/tag -mx-2 flex items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-cream"
          >
            <span className="font-serif text-2xl text-saffron tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-ink transition-colors group-hover/tag:text-saffron">
                  #{t.tag}
                </span>
                {t.rising ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-moss">
                    <ArrowUp className="size-3" /> Rising
                  </span>
                ) : null}
                {t.forYou ? (
                  <span className="shrink-0 rounded-full bg-saffron/10 px-2 py-0.5 text-[10px] font-semibold text-saffron-dk">
                    In your field
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-ash tabular-nums">{metaLine(t)}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 self-center text-ash opacity-0 transition-all group-hover/tag:translate-x-0.5 group-hover/tag:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function metaLine(t: TrendingTag): string {
  const posts = `${t.count} ${t.count === 1 ? "post" : "posts"}`;
  if (t.authors > 1) return `${posts} · ${t.authors} people`;
  return posts;
}
