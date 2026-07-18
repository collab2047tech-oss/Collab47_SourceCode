import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manifesto",
  description:
    "Why we are building Collab47: our belief in a unified academia-industry ecosystem for India, where talent, innovation and opportunity converge.",
  alternates: { canonical: "/manifesto" },
};

export default function ManifestoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
