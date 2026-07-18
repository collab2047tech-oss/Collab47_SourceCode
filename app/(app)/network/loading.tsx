// Instant skeleton for the Network surface. Mirrors the page geometry (hero,
// Manage tabs, PersonCard grid) so navigation paints immediately instead of
// blocking on the server render.
function CardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-lg border border-bone bg-paper p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="size-14 shrink-0 animate-pulse rounded-full bg-bone" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-bone" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-bone/70" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-bone/60" />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-bone/70" />
        <div className="h-10 flex-1 animate-pulse rounded-md bg-bone/70" />
        <div className="h-10 flex-1 animate-pulse rounded-md bg-bone/70" />
      </div>
    </div>
  );
}

export default function NetworkLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <div className="rule-top">
        <div className="h-4 w-28 animate-pulse rounded bg-bone" />
        <div className="mt-4 h-11 w-2/3 max-w-md animate-pulse rounded bg-bone" />
      </div>

      {/* Manage tabs */}
      <div className="mt-16 h-4 w-40 animate-pulse rounded bg-bone" />
      <div className="mt-4 flex gap-3 border-b border-bone pb-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-6 w-24 animate-pulse rounded-full bg-bone/70" />
        ))}
      </div>

      {/* Card grid */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
