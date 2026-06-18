"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { searchAction } from "@/app/(app)/explore/actions";

type SearchResults = Awaited<ReturnType<typeof searchAction>>;

export function ExploreSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAction(query);
        setResults(res);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hasResults =
    results &&
    (results.people.length > 0 ||
      results.posts.length > 0 ||
      results.projects.length > 0 ||
      results.hashtags.length > 0);

  return (
    <div className="mb-10">
      {/* Search box */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, projects, hashtags..."
          className="h-12 w-full rounded-full border border-bone bg-paper pl-11 pr-5 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none"
        />
        {isPending && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-ash">
            Searching...
          </span>
        )}
      </div>

      {/* Results */}
      {query.trim() && results && (
        <div className="mt-4 space-y-6">
          {/* People */}
          {results.people.length > 0 && (
            <section>
              <p className="mb-3 text-caption">People</p>
              <ul className="space-y-2">
                {results.people.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/u/${p.handle}`}
                      className="flex items-center gap-3 rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:border-saffron"
                    >
                      <Avatar
                        name={p.name}
                        src={(p.avatar_url as string | null) ?? undefined}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {p.name}
                        </p>
                        <p className="truncate text-xs text-ash">
                          @{p.handle}
                          {p.college ? ` . ${p.college}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Posts */}
          {results.posts.length > 0 && (
            <section>
              <p className="mb-3 text-caption">Posts</p>
              <ul className="space-y-2">
                {results.posts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/p/${p.short_id}`}
                      className="block rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:border-saffron"
                    >
                      <p className="line-clamp-2 text-sm text-ink">{p.body}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Projects */}
          {results.projects.length > 0 && (
            <section>
              <p className="mb-3 text-caption">Projects</p>
              <ul className="space-y-2">
                {results.projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/c/${p.short_id}`}
                      className="block rounded-lg border border-bone bg-paper px-4 py-3 transition-all hover:border-saffron"
                    >
                      <p className="text-sm font-semibold text-ink">{p.title}</p>
                      {p.brief && (
                        <p className="mt-1 line-clamp-1 text-xs text-ash">
                          {p.brief}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Hashtags */}
          {results.hashtags.length > 0 && (
            <section>
              <p className="mb-3 text-caption">Hashtags</p>
              <div className="flex flex-wrap gap-2">
                {results.hashtags.map((h) => (
                  <Tag key={h.tag} variant="saffron">
                    #{h.tag}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {!hasResults && !isPending && (
            <p className="py-6 text-center text-sm text-ash">
              No results for &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
