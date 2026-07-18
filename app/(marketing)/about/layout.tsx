import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Collab47 is the missing link between academia and industry, connecting students, researchers, faculty, institutions and industry across India.",
  alternates: { canonical: "/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
