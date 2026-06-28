"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { searchAllAction } from "@/app/(app)/explore/actions";
import { getCachedSearch, setCachedSearch } from "@/lib/search/clientCache";
import { pushRecentSearch } from "@/lib/search/recent";
import { SearchResultsList, flattenResults } from "@/components/search/SearchResults";
import type { SearchResults } from "@/lib/db/social";

const DEBOUNCE_MS = 180;

function hasAny(r: SearchResults | null): boolean {
  return Boolean(
    r && (r.people.length || r.posts.length || r.projects.length || r.hashtags.length)
  );
}

/**
 * Full-page Explore search. Seeded with the server-rendered initial query +
 * results from /explore?q= so a top-bar submit lands on a populated, editable
 * box (the old box dropped the URL query entirely). Reuses the same ranked data
 * layer and shared result rows as the top-bar dropdown.
 */
export function ExploreSearch({
  initialQuery = "",
  initialResults = null,
}: {
  initialQuery?: string;
  initialResults?: SearchResults | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(initialResults);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track the query the current `results` belong to so we don't re-fetch the
  // server-seeded initial query on mount.
  const seededQuery = useRef(initialQuery.trim());

  const trimmed = query.trim();
  const flat = results ? flattenResults(results) : [];

  // Seed the client cache with the server-rendered initial results.
  useEffect(() => {
    if (initialQuery.trim() && initialResults) {
      setCachedSearch(initialQuery.trim(), false, initialResults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!trimmed) {
      setResults(null);
      setActiveIndex(-1);
      return;
    }
    // Don't re-fetch the query we were seeded with on first render.
    if (trimmed === seededQuery.current && results) return;

    const cached = getCachedSearch(trimmed, false);
    if (cached) {
      setResults(cached);
      setActiveIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAllAction(trimmed);
        setCachedSearch(trimmed, false, res);
        setResults(res);
        setActiveIndex(-1);
        seededQuery.current = "";
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length) setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length) setActiveIndex((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && flat[activeIndex]) {
        if (trimmed) pushRecentSearch(trimmed);
        router.push(flat[activeIndex].href);
      }
    } else if (e.key === "Escape" && trimmed) {
      setQuery("");
    }
  }

  const activeHref = activeIndex >= 0 ? flat[activeIndex]?.href : null;
  const noResults = trimmed && !isPending && results !== null && !hasAny(results);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search people, posts, projects, #hashtags"
          aria-label="Search Collab47"
          className="h-12 w-full rounded-full border border-bone bg-paper pl-11 pr-11 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-ash transition-colors hover:text-ink"
          >
            <X className="size-4" />
          </button>
        ) : null}
        {isPending ? (
          <span className="absolute right-11 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-bone border-t-saffron" />
        ) : null}
      </div>

      {trimmed ? (
        <div className="mt-4 rounded-2xl border border-bone bg-paper p-1.5">
          {isPending && !results ? (
            <SkeletonRows />
          ) : noResults ? (
            <p className="px-3 py-8 text-center text-sm text-ash">
              No results for &ldquo;{trimmed}&rdquo;. Try a name, @handle, #tag, or project.
            </p>
          ) : results ? (
            <SearchResultsList
              results={results}
              activeHref={activeHref}
              onActivate={() => trimmed && pushRecentSearch(trimmed)}
              onHover={(href) => router.prefetch(href)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-1 p-1.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1.5 py-2">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-bone" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-bone" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-bone" />
          </div>
        </div>
      ))}
    </div>
  );
}
