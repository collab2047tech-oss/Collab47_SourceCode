"use client";

import { Reveal } from "@/components/motion/Reveal";

export function Quote() {
  return (
    <section className="bg-ink py-32 md:py-48">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption text-cream/60">The Shift</p>
        </Reveal>
        <Reveal delay={0.1}>
          <blockquote className="mt-10 max-w-5xl font-serif text-4xl leading-tight text-cream md:text-6xl">
            It is the platform LinkedIn{" "}
            <span className="italic text-saffron">becomes</span> when Indian
            students graduate from it.
          </blockquote>
        </Reveal>
        <Reveal delay={0.25}>
          <p className="mt-12 text-caption text-cream/60">
            Akshpreet, CEO & Co-founder
          </p>
        </Reveal>
      </div>
    </section>
  );
}
