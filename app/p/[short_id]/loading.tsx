// Instant skeleton for a single post page so opening a post from the feed paints
// at once instead of blocking on the dynamic server render + comment fetch.
export default function PostLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="card px-4 py-5">
        <div className="flex gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-bone" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-bone" />
            <div className="space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-bone" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-bone" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-bone" />
            </div>
            <div className="h-56 w-full animate-pulse rounded-xl bg-bone/60" />
          </div>
        </div>
      </div>
      {/* Comment composer + list skeleton */}
      <div className="mt-6 space-y-4">
        <div className="h-11 w-full animate-pulse rounded-full bg-bone/60" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="size-8 shrink-0 animate-pulse rounded-full bg-bone" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-1/4 animate-pulse rounded bg-bone" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-bone/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
