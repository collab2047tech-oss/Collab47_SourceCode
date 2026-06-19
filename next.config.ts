import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
