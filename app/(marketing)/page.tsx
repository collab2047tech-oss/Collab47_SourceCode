import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Product } from "@/components/landing/Product";
import { Quote } from "@/components/landing/Quote";
import { CTABand } from "@/components/landing/CTABand";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main>
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
