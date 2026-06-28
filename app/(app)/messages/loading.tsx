// Instant skeleton for the Messages route so clicking the inbox paints at once
// instead of waiting ~1s on the force-dynamic layout's conversation query.
export default function MessagesLoading() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full">
      {/* Conversation rail skeleton */}
      <div className="hidden w-80 shrink-0 border-r border-bone p-3 sm:block">
        <div className="mb-4 h-9 w-full animate-pulse rounded-full bg-bone/70" />
        <div className="space-y-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
              <div className="size-11 shrink-0 animate-pulse rounded-full bg-bone" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-bone" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-bone/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Thread pane skeleton */}
      <div className="hidden flex-1 items-center justify-center sm:flex">
        <div className="size-10 animate-pulse rounded-full bg-bone" />
      </div>
      {/* Mobile: just the rail */}
      <div className="w-full p-3 sm:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            <div className="size-11 shrink-0 animate-pulse rounded-full bg-bone" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-1/2 animate-pulse rounded bg-bone" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-bone/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
