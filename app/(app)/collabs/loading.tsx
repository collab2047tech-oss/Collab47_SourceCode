// Instant skeleton for the Collabs discovery grid. Geometry mirrors page.tsx
// (max-w-4xl header + status chips + category/commitment rows + 2-col card grid)
// so navigating in paints immediately instead of blocking on the Supabase query.
export default function CollabsLoading() {
  return (
    <div className="max-w-4xl" aria-busy="true">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-bone" />
          <div className="h-9 w-72 animate-pulse rounded bg-bone/70" />
        </div>
        <div className="h-11 w-28 animate-pulse rounded-lg bg-bone" />
      </div>

      {/* Status chips */}
      <div className="mt-8 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-20 animate-pulse rounded-full bg-bone/70" />
        ))}
      </div>

      {/* Category + commitment rows */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 w-20 animate-pulse rounded-full bg-bone/50" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 w-20 animate-pulse rounded-full bg-bone/50" />
          ))}
        </div>
      </div>

      {/* Card grid */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border border-bone bg-paper p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-bone" />
              <div className="h-5 w-14 animate-pulse rounded-full bg-bone/60" />
            </div>
            <div className="mt-3 h-3 w-24 animate-pulse rounded bg-bone/50" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-bone/60" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-bone/50" />
            </div>
            <div className="mt-5 h-3 w-1/2 animate-pulse rounded bg-bone/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
