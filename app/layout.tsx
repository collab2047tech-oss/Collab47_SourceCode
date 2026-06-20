import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LenisProvider } from "@/components/motion/LenisProvider";

export const metadata: Metadata = {
  title: "Collab47. The professional network Indian students build first.",
  description:
    "Portfolio. Collaboration. Career intelligence. Before LinkedIn matters. Built in India, for India's next generation.",
  metadataBase: new URL("https://collab47.com"),
  openGraph: {
    title: "Collab47",
    description:
      "The portfolio and collaboration network that LinkedIn becomes when Indian students graduate from it.",
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
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+Devanagari:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
