"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/primitives/Button";

// Route-level error boundary for the Collabs grid. A thrown Supabase query no
// longer crashes to the framework error page - the reader gets a recoverable
// state with a retry (reset re-runs the server render).
export default function CollabsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for local debugging; production logging is handled upstream.
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-4xl">
      <p className="text-caption text-saffron">Something went wrong</p>
      <h1 className="mt-2 font-serif text-2xl leading-tight text-ink sm:text-3xl">
        We couldn&apos;t load the collabs.
      </h1>
      <p className="mt-3 max-w-md text-body-sm text-ash">
        This is usually temporary. Try again, or head back and reopen the page.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={reset} size="md">
          Try again
        </Button>
        <Link href="/collabs/new">
          <Button type="button" variant="secondary" size="md">
            Post a brief
          </Button>
        </Link>
      </div>
    </div>
  );
}
