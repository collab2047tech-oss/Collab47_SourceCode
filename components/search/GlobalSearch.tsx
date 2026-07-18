"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { searchAction } from "@/app/(app)/explore/actions";
import { getCachedSearch, setCachedSearch } from "@/lib/search/clientCache";
import { getRecentSearches, pushRecentSearch } from "@/lib/search/recent";
import { SearchResultsList, flattenResults } from "@/components/search/SearchResults";
import type { SearchResults, TrendingTag } from "@/lib/db/social";

const DEBOUNCE_MS = 180;

function hasAny(r: SearchResults | null): boolean {
  return Boolean(
    r && (r.people.length || r.posts.length || r.projects.length || r.hashtags.length)
  );
}

export function GlobalSearch({
  className,
  trending = [],
}: {
  className?: string;
  /** Top trending tags shown in the empty/focused state (no extra query). */
  trending?: TrendingTag[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();

  const trimmed = query.trim();
  const flat = results ? flattenResults(results) : [];

  // Hydrate recent searches when the panel opens (client-only localStorage).
  useEffect(() => {
    if (open) setRecent(getRecentSearches());
  }, [open]);

  // Debounced search with client-cache short-circuit.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!trimmed) {
      setResults(null);
      setActiveIndex(-1);
      return;
    }
    const cached = getCachedSearch(trimmed, true);
    if (cached) {
      setResults(cached);
      setActiveIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAction(trimmed);
        setCachedSearch(trimmed, true, res);
        setResults(res);
        setActiveIndex(-1);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Cmd/Ctrl+K focuses + opens the search (Notion/Linear convention).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const goToAll = useCallback(
    (q: string) => {
      const term = q.trim();
      if (!term) return;
      pushRecentSearch(term);
      setOpen(false);
      router.push(`/explore?q=${encodeURIComponent(term)}`);
    },
    [router]
  );

  const navigate = useCallback(
    (href: string) => {
      if (trimmed) pushRecentSearch(trimmed);
      setOpen(false);
      router.push(href);
    },
    [router, trimmed]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length === 0) return;
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && flat[activeIndex]) navigate(flat[activeIndex].href);
      else goToAll(trimmed);
    } else if (e.key === "Escape") {
      if (trimmed) setQuery("");
      else setOpen(false);
      inputRef.current?.blur();
    }
  }

  const activeHref = activeIndex >= 0 ? flat[activeIndex]?.href : null;
  const showResults = trimmed.length > 0;
  const noResults = showResults && !isPending && !hasAny(results) && results !== null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* LinkedIn-style search field: a real input-shaped affordance (icon +
          field + ⌘K hint), not a naked icon. min-h-11 clears the 44px tap
          floor; the whole field lights up with a saffron ring on focus. */}
      <div
        className="flex min-h-11 items-center gap-2.5 rounded-full border border-bone bg-paper px-4 transition-colors focus-within:border-saffron/50 focus-within:ring-2 focus-within:ring-saffron/25"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-owns={listboxId}
      >
        <Search className="size-4 shrink-0 text-ash" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search people, posts, projects, tags"
          aria-label="Search Collab47"
          aria-autocomplete="list"
          aria-controls={listboxId}
          className="w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ash"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="-mr-1 shrink-0 rounded-full p-1 text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 select-none rounded border border-bone bg-cream px-1.5 py-0.5 text-[10px] font-medium text-ash md:inline">
            ⌘K
          </kbd>
        )}
      </div>

      {open && (
        <div
          id={listboxId}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-auto rounded-2xl border border-bone bg-paper p-1.5 shadow-lg"
        >
          {showResults ? (
            <>
              {isPending && !results ? (
                <SkeletonRows />
              ) : noResults ? (
                <p className="px-3 py-6 text-center text-sm text-ash">
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

              <button
                type="button"
                onClick={() => goToAll(trimmed)}
                className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-saffron-dk transition-colors hover:bg-cream"
              >
                <span className="truncate">
                  See all results for &ldquo;{trimmed}&rdquo;
                </span>
                <ArrowRight className="size-4 shrink-0" />
              </button>
            </>
          ) : (
            <EmptyState
              recent={recent}
              trending={trending}
              onPick={(q) => {
                setQuery(q);
                inputRef.current?.focus();
              }}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-1 p-1.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1.5 py-2">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-bone" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-2/5 animate-pulse rounded bg-bone" />
            <div className="h-2.5 w-3/5 animate-pulse rounded bg-bone" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  recent,
  trending,
  onPick,
  onClose,
}: {
  recent: string[];
  trending: TrendingTag[];
  onPick: (q: string) => void;
  onClose: () => void;
}) {
  if (recent.length === 0 && trending.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-ash">
        Search for people, posts, projects, or #hashtags.
      </p>
    );
  }
  return (
    <div className="py-1">
      {recent.length > 0 && (
        <section>
          <p className="px-3 pb-1.5 pt-2 text-caption">
            Recent
          </p>
          {recent.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-cream"
            >
              <Clock className="size-4 shrink-0 text-ash" />
              <span className="truncate text-sm text-ink">{q}</span>
            </button>
          ))}
        </section>
      )}
      {trending.length > 0 && (
        <section>
          <p className="px-3 pb-1.5 pt-2 text-caption">
            Trending
          </p>
          {trending.slice(0, 6).map((t) => (
            <Link
              key={t.tag}
              href={`/t/${t.tag}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-cream"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-saffron/10 text-sm font-semibold text-saffron-dk">
                #
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">#{t.tag}</span>
                <span className="block text-xs text-ash tabular-nums">
                  {t.count} {t.count === 1 ? "post" : "posts"}
                </span>
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
