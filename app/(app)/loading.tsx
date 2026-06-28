// Generic instant skeleton for app routes without a more specific loading.tsx
// (explore, news, network, notifications, profile, settings, collabs). Makes
// every in-app navigation paint immediately instead of blocking on the
// force-dynamic server render.
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-5xl px-1 py-2">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-bone" />
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-bone bg-paper p-4">
            <div className="size-11 shrink-0 animate-pulse rounded-full bg-bone" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-3 w-1/3 animate-pulse rounded bg-bone" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-bone/60" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-bone/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
