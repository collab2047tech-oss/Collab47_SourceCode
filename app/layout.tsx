import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LenisProvider } from "@/components/motion/LenisProvider";

export const metadata: Metadata = {
  title: "Collab47. Where talent, innovation and opportunity converge.",
  description:
    "India's unified academia-industry collaboration ecosystem. Showcase expertise, discover opportunities, and build impactful collaborations - for students, researchers, faculty, institutions and industry.",
  metadataBase: new URL("https://collab47.com"),
  openGraph: {
    title: "Collab47",
    description:
      "India's unified academia-industry collaboration ecosystem. Built for India. Built to Lead.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#F5F7FB",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
