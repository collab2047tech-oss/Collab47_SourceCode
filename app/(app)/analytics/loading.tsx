// Instant skeleton for the analytics route. Mirrors app/(app)/loading.tsx so
// navigation paints immediately instead of blocking on the force-dynamic render.
export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-1 py-2">
      {/* Header */}
      <div className="h-4 w-32 animate-pulse rounded bg-bone/60" />
      <div className="mt-3 h-8 w-56 animate-pulse rounded bg-bone" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-bone/60" />

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-bone bg-paper p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-bone/60" />
            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-bone" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-bone bg-paper p-5">
            <div className="h-4 w-40 animate-pulse rounded bg-bone" />
            <div className="mt-4 h-36 animate-pulse rounded-lg bg-bone/50" />
          </div>
        ))}
      </div>

      {/* Top posts */}
      <div className="mt-8 rounded-xl border border-bone bg-paper p-5">
        <div className="h-4 w-28 animate-pulse rounded bg-bone" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 flex-1 animate-pulse rounded bg-bone/60" />
              <div className="h-4 w-16 animate-pulse rounded bg-bone/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
