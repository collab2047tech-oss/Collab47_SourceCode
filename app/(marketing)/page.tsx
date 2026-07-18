import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Product } from "@/components/landing/Product";
import { Quote } from "@/components/landing/Quote";
import { CTABand } from "@/components/landing/CTABand";
import { Footer } from "@/components/landing/Footer";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://collab47.com/#organization",
      name: "Collab47",
      legalName: "Collab47 Technologies Private Limited",
      url: "https://collab47.com",
      logo: "https://collab47.com/icon",
      description:
        "India's unified academia-industry collaboration ecosystem. Showcase expertise, discover opportunities, and build impactful collaborations for students, researchers, faculty, institutions and industry.",
      areaServed: "IN",
    },
    {
      "@type": "WebSite",
      "@id": "https://collab47.com/#website",
      url: "https://collab47.com",
      name: "Collab47",
      publisher: { "@id": "https://collab47.com/#organization" },
    },
  ],
};

export default function LandingPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />
      <Hero />
      <Problem />
      <Product />
      <Quote />
      <CTABand />
      <Footer />
    </main>
  );
}
