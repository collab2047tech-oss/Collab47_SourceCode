import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found · Collab47",
};

export default function NotFound() {
  return (
    <main className="container-edit section" style={{ minHeight: "70dvh" }}>
      <div style={{ maxWidth: "36rem" }}>
        <p className="text-caption" style={{ color: "var(--color-saffron)" }}>
          Error 404
        </p>
        <h1
          className="text-display-md"
          style={{ marginTop: "0.75rem", color: "var(--color-ink)" }}
        >
          This page wandered off.
        </h1>
        <p
          style={{
            marginTop: "1.25rem",
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--text-body-lg--line-height)",
            color: "var(--color-ash)",
          }}
        >
          The link may be broken, or the page may have moved. Let&apos;s get you
          back to where the collaboration happens.
        </p>
        <Link
          href="/"
          className="tap"
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginTop: "2rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "var(--radius-full)",
            background: "var(--color-saffron)",
            color: "var(--color-cream)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
