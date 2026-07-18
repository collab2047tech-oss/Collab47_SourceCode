import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root. A stray package-lock.json in the user's home dir made
  // Turbopack infer ~/ as the root, so it looked for the app there and every route
  // 404'd. Explicit root removes the ambiguity permanently.
  turbopack: {
    root: __dirname,
  },
  // Hide the Next.js dev indicator badge (bottom-left).
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Media is uploaded client-side to Supabase Storage; Server Actions only
    // receive text + URLs. This raised limit is just a safety margin.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async redirects() {
    return [
      // Canonical host: force www -> apex (https://collab47.com) with a 308.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.collab47.com" }],
        destination: "https://collab47.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Content-Security-Policy is intentionally Report-Only for now so it cannot
    // break the app. Origins enumerated from the codebase:
    //   - Supabase (NEXT_PUBLIC_SUPABASE_URL host munpgkzcukoccoactszz.supabase.co,
    //     plus *.supabase.co for storage/realtime, incl. wss: for realtime)
    //   - Google Fonts (fonts.googleapis.com stylesheet + fonts.gstatic.com files)
    //   - Vercel + Supabase Storage images (self, data:, https:)
    // TODO: monitor CSP violation reports, tune this policy, then switch the
    // header name to "Content-Security-Policy" (enforced).
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
