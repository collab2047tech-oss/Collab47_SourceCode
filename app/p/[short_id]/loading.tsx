// Instant skeleton for the post page. Geometry MIRRORS the real page exactly -
// a fixed top-nav placeholder (PublicTopNav is h-16 fixed and is NOT part of a
// layout, so it does not paint during loading) plus the same
// `container-edit max-w-2xl pt-32 pb-20` shell. This kills the old "content
// slams down pt-32 and a nav pops in" jump that contributed to the blast.
export default function PostLoading() {
  return (
    <main className="min-h-dvh bg-cream" aria-busy="true">
      {/* Top-nav placeholder: matches PublicTopNav's fixed h-16 bar. */}
      <div className="fixed inset-x-0 top-0 z-50 h-16 border-b border-bone bg-cream/85 backdrop-blur-md" />

      <div className="container-edit max-w-2xl pt-32 pb-20" aria-hidden="true">
        {/* Author row */}
        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-bone" />
          <div className="space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-bone" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-bone/60" />
          </div>
        </div>

        {/* Body */}
        <div className="mt-5 space-y-2.5">
          <div className="h-3 w-full animate-pulse rounded bg-bone" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-bone" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-bone/70" />
        </div>

        {/* Media (fixed aspect box - no shift) */}
        <div className="mt-4 aspect-video w-full animate-pulse rounded-xl bg-bone/50" />

        {/* Action bar */}
        <div className="mt-6 flex gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-12 animate-pulse rounded-full bg-bone/60" />
          ))}
        </div>

        {/* Comments */}
        <div className="mt-10 space-y-4 border-t border-bone pt-6">
          <div className="h-3 w-24 animate-pulse rounded bg-bone" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="size-8 shrink-0 animate-pulse rounded-full bg-bone" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-2.5 w-1/4 animate-pulse rounded bg-bone" />
                <div className="h-2.5 w-3/4 animate-pulse rounded bg-bone/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
