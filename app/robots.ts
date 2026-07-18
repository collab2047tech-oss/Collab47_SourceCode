import type { MetadataRoute } from "next";

// Mirrors middleware.ts GATED_PREFIXES (gated app surfaces) plus the auth and
// API routes that should never be indexed. Public content (/news, /news/[id],
// /t/[tag], /u, /p, /c) is intentionally crawlable and lives outside this list.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/home",
        "/explore",
        "/network",
        "/messages",
        "/profile",
        "/settings",
        "/notifications",
        "/onboarding",
        "/collabs",
        "/events",
        "/analytics",
        "/queue",
        "/feedback",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: "https://collab47.com/sitemap.xml",
    host: "https://collab47.com",
  };
}
