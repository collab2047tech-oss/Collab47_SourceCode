import type { Metadata, Viewport } from "next";
import { Sora, Inter, JetBrains_Mono, Noto_Sans_Devanagari } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { LenisProvider } from "@/components/motion/LenisProvider";

// Self-hosted (build-time) versions of the exact same families the site already
// used - identical look, but no render-blocking third-party fetch and fallback
// metrics that remove the font-swap layout shift. Exposed as CSS variables that
// globals.css maps onto --font-serif/--font-sans/--font-mono/--font-indic.
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "600"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://collab47.com"),
  title: {
    default: "Collab47. Where talent, innovation and opportunity converge.",
    template: "%s | Collab47",
  },
  description:
    "India's unified academia-industry collaboration ecosystem. Showcase expertise, discover opportunities, and build impactful collaborations - for students, researchers, faculty, institutions and industry.",
  applicationName: "Collab47",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Collab47",
    url: "https://collab47.com",
    locale: "en_IN",
    title: "Collab47. Where talent, innovation and opportunity converge.",
    description:
      "India's unified academia-industry collaboration ecosystem. Showcase expertise, discover opportunities, and build impactful collaborations - for students, researchers, faculty, institutions and industry.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Collab47",
    description: "India's unified academia-industry collaboration ecosystem.",
  },
  robots: { index: true, follow: true },
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
    <html
      lang="en-IN"
      className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} ${notoDevanagari.variable}`}
    >
      <body>
        <LenisProvider>{children}</LenisProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
