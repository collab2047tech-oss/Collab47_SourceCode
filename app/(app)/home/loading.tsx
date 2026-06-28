// Instant route-transition skeleton for /home so navigating to the feed paints
// immediately instead of blocking on the force-dynamic server render.
export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-270">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* Composer skeleton */}
          <div className="card flex items-center gap-3 px-4 py-4">
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-bone" />
            <div className="h-10 flex-1 animate-pulse rounded-full bg-bone/70" />
          </div>
          {/* Tab bar skeleton */}
          <div className="flex gap-4 border-b border-bone pb-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-16 animate-pulse rounded bg-bone" />
            ))}
          </div>
          {/* Feed card skeletons */}
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 border-b border-bone px-1 py-5">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-bone" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-3 w-1/3 animate-pulse rounded bg-bone" />
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-bone" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-bone" />
                </div>
                <div className="h-40 w-full animate-pulse rounded-xl bg-bone/60" />
              </div>
            </div>
          ))}
        </div>
        <aside className="hidden lg:block">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-40 animate-pulse bg-bone/40" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
