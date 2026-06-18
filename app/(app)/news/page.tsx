/**
 * /news - full news feed page (server component).
 * Filterable by branch via ?branch= query param.
 */

import { getNewsForUser } from "@/lib/news/fetch";
import type { NewsItem } from "@/lib/supabase/types";
import Link from "next/link";

const BRANCH_CHIPS = [
  "All",
  "CSE",
  "ECE",
  "Mechanical",
  "Civil",
  "Electrical",
  "MBA",
  "BBA",
  "Design",
  "Biotech",
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NewsCardProps {
  item: NewsItem;
}

function NewsCard({ item }: NewsCardProps) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-bone bg-paper p-5 transition-colors hover:border-saffron"
    >
      {item.image_url && (
        <div className="mb-4 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt=""
            className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-caption font-medium uppercase tracking-widest text-ash">
          {item.source}
        </span>
        <span className="text-ash">&#183;</span>
        <span className="text-caption text-ash">{timeAgo(item.published_at)}</span>
      </div>

      <h3 className="font-serif text-h3 leading-snug text-ink group-hover:text-saffron transition-colors line-clamp-3 flex-1">
        {item.title}
      </h3>

      {item.excerpt && (
        <p className="mt-3 text-body-sm text-ash line-clamp-2">{item.excerpt}</p>
      )}

      {item.branch_tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.branch_tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-saffron/10 px-2.5 py-0.5 text-xs font-medium text-saffron"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

interface NewsPageProps {
  searchParams: Promise<{ branch?: string }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const params = await searchParams;
  const activeBranch = params.branch && params.branch !== "All" ? params.branch : undefined;
  const items: NewsItem[] = await getNewsForUser(activeBranch, undefined, 20);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="rule-top mb-10">
        <p className="text-caption mb-2 font-medium uppercase tracking-widest text-ash">
          News
        </p>
        <h1 className="font-serif text-display-md text-ink leading-none">
          What today means
          <br />
          for your branch.
        </h1>
      </div>

      {/* Branch filter chips */}
      <div className="mb-8 flex flex-wrap gap-2">
        {BRANCH_CHIPS.map((chip) => {
          const isActive =
            chip === "All" ? !activeBranch : activeBranch === chip;
          const href =
            chip === "All" ? "/news" : `/news?branch=${encodeURIComponent(chip)}`;
          return (
            <Link
              key={chip}
              href={href}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-ink text-cream"
                  : "border border-bone bg-paper text-ink hover:border-saffron hover:text-saffron",
              ].join(" ")}
            >
              {chip}
            </Link>
          );
        })}
      </div>

      {/* Grid */}
      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-h3 font-serif text-ink mb-2">Nothing yet.</p>
          <p className="text-ash text-body-sm">
            The news engine runs hourly. Check back soon, or{" "}
            <Link href="/news" className="text-saffron underline">
              clear your filter.
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
