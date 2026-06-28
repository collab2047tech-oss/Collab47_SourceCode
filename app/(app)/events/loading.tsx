// Instant skeleton for the Events surface. Mirrors the generic app loading.tsx
// but lays out a card grid so the page paints immediately instead of blocking
// on the force-dynamic server render.
export default function EventsLoading() {
  return (
    <div className="max-w-5xl">
      <div className="h-4 w-44 animate-pulse rounded bg-bone" />
      <div className="mt-4 h-9 w-2/3 max-w-md animate-pulse rounded bg-bone" />
      <div className="mt-6 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-bone/70" />
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-bone bg-paper">
            <div className="aspect-[16/9] w-full animate-pulse bg-bone" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-bone/70" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-bone" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-bone/60" />
              <div className="mt-2 h-9 w-full animate-pulse rounded-lg bg-bone/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
