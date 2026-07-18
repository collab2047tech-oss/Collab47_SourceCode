/**
 * Explore route skeleton - mirrors the discover-mode geometry (masthead, search,
 * asymmetric 8/4 and 5/7 rows, project band) so there is no layout pop when the
 * real, server-fetched surface paints. Decorative; the real content announces
 * itself.
 */
export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-6xl" aria-hidden>
      {/* Masthead */}
      <div className="rule-top">
        <div className="h-3 w-20 animate-pulse rounded bg-bone" />
        <div className="mt-5 h-12 w-3/4 animate-pulse rounded bg-bone sm:h-16" />
        <div className="mt-5 h-4 w-1/2 animate-pulse rounded bg-bone" />
      </div>

      {/* Search */}
      <div className="mt-8 h-12 w-full animate-pulse rounded-full bg-bone" />

      {/* Row 1: people (8) + trending (4) */}
      <div className="mt-14 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="h-8 w-full animate-pulse rounded bg-bone" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg border border-bone bg-paper" />
            ))}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-4">
          <div className="h-8 w-full animate-pulse rounded bg-bone" />
          <div className="h-72 animate-pulse rounded-lg border border-bone bg-paper" />
        </div>
      </div>

      {/* Row 2: leaderboard (5) + hashtags (7) */}
      <div className="mt-16 grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <div className="h-8 w-full animate-pulse rounded bg-bone" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-bone/70" />
          ))}
        </div>
        <div className="space-y-4 lg:col-span-7">
          <div className="h-8 w-full animate-pulse rounded bg-bone" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-bone" />
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: projects */}
      <div className="mt-16 space-y-6">
        <div className="h-8 w-full animate-pulse rounded bg-bone" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg border border-bone bg-paper" />
          ))}
        </div>
      </div>
    </div>
  );
}
