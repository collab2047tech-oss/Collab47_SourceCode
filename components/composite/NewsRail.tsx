/**
 * NewsRail - server component.
 * Renders a compact vertical list of news cards in the right rail.
 */

import { getNewsForUser } from "@/lib/news/fetch";
import type { NewsItem } from "@/lib/supabase/types";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NewsRailProps {
  branch?: string;
  city?: string;
}

export async function NewsRail({ branch, city }: NewsRailProps) {
  const items: NewsItem[] = await getNewsForUser(branch, city, 6);

  return (
    <section>
      <div className="mb-4">
        <p className="text-caption font-medium uppercase tracking-widest text-ash">
          Daily brief
        </p>
        <p className="mt-0.5 text-xs text-ash">
          Career news for your branch
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/news/${item.id}`}
            className="card card-hover group block p-4"
          >
            <div className="flex gap-3">
              {item.image_url && (
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-14 w-14 rounded-md object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-caption mb-1 font-medium uppercase tracking-widest text-ash">
                  {item.source}
                </p>
                <p className="line-clamp-2 font-serif text-sm leading-snug text-ink group-hover:text-saffron transition-colors">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-ash">{timeAgo(item.published_at)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {items.length > 0 && (
        <div className="mt-4">
          <Link
            href="/news"
            className="group inline-flex items-center gap-1 text-caption font-medium text-saffron"
          >
            See all news
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border border-bone bg-paper p-5 text-center">
          <p className="text-sm text-ash">No news yet. Check back soon.</p>
        </div>
      )}
    </section>
  );
}
