"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/primitives/Button";

// Route-level error boundary for the project page. A thrown query used to crash
// to the framework error page; the reader now gets a recoverable state with a
// retry (reset re-runs the server render), inside the same standalone shell the
// page uses (PublicTopNav is not part of a layout, so a placeholder bar keeps
// the geometry stable).
export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-cream">
      <div className="fixed inset-x-0 top-0 z-50 h-16 border-b border-bone bg-cream/85 backdrop-blur-md" />
      <div className="container-edit max-w-3xl pt-28 pb-20 md:pt-32">
        <p className="text-caption text-saffron">Something went wrong</p>
        <h1 className="mt-3 font-serif text-2xl leading-tight text-ink sm:text-3xl">
          We couldn&apos;t load this project.
        </h1>
        <p className="mt-3 max-w-md text-body-sm text-ash">
          The link may be broken, or the request hit a snag. Try again, or browse
          other open briefs.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={reset} size="md">
            Try again
          </Button>
          <Link href="/collabs">
            <Button type="button" variant="secondary" size="md">
              Back to Collabs
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
