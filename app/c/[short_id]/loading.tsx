// Instant skeleton for the project page. Geometry MIRRORS page.tsx: a fixed
// top-nav placeholder (PublicTopNav is h-16 fixed and NOT part of a layout, so
// it does not paint during loading) plus the same
// `container-edit max-w-3xl pt-28 pb-20` shell and hero order (chips -> title ->
// one-liner -> author -> meta bar -> sections). Kills the layout jump.
export default function ProjectLoading() {
  return (
    <main className="min-h-dvh bg-cream" aria-busy="true">
      {/* Top-nav placeholder: matches PublicTopNav's fixed h-16 bar. */}
      <div className="fixed inset-x-0 top-0 z-50 h-16 border-b border-bone bg-cream/85 backdrop-blur-md" />

      <div className="container-edit max-w-3xl pt-28 pb-20 md:pt-32" aria-hidden="true">
        {/* Back link */}
        <div className="h-3 w-28 animate-pulse rounded bg-bone" />

        {/* Chips */}
        <div className="mt-6 flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-full bg-bone/60" />
          <div className="h-6 w-14 animate-pulse rounded-full bg-bone/60" />
        </div>

        {/* Title */}
        <div className="mt-4 space-y-3">
          <div className="h-9 w-11/12 animate-pulse rounded bg-bone" />
          <div className="h-9 w-2/3 animate-pulse rounded bg-bone/70" />
        </div>

        {/* One-liner */}
        <div className="mt-4 h-4 w-4/5 animate-pulse rounded bg-bone/50" />

        {/* Author */}
        <div className="mt-6 flex items-center gap-3">
          <div className="size-9 animate-pulse rounded-full bg-bone" />
          <div className="h-3 w-32 animate-pulse rounded bg-bone/60" />
        </div>

        {/* Meta bar */}
        <div className="mt-8 flex gap-6 border-y border-bone py-4">
          <div className="h-3 w-24 animate-pulse rounded bg-bone/60" />
          <div className="h-3 w-28 animate-pulse rounded bg-bone/50" />
        </div>

        {/* The work */}
        <div className="mt-10 space-y-2.5">
          <div className="h-3 w-24 animate-pulse rounded bg-bone" />
          <div className="h-3 w-full animate-pulse rounded bg-bone/60" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-bone/50" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-bone/50" />
        </div>

        {/* Roles grid */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-bone bg-paper p-5">
              <div className="h-4 w-1/2 animate-pulse rounded bg-bone" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-14 animate-pulse rounded-full bg-bone/50" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-bone/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
