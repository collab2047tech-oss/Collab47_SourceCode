"use client";

import { Reveal } from "@/components/motion/Reveal";

export function Quote() {
  return (
    <section className="bg-ink py-24 sm:py-32 md:py-48">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption text-cream/60">The Shift</p>
        </Reveal>
        <Reveal delay={0.1}>
          <blockquote className="relative mt-8 max-w-5xl font-serif text-[2rem] leading-[1.15] text-cream sm:mt-10 sm:text-4xl md:text-6xl">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-1 -top-8 select-none font-serif text-7xl leading-none text-saffron/30 sm:-top-10 sm:text-8xl"
            >
              &ldquo;
            </span>
            Build in the open from day one. The work{" "}
            <span className="italic text-saffron">compounds</span>, and the right
            people find you.
          </blockquote>
        </Reveal>
        <Reveal delay={0.25}>
          <div className="mt-10 flex items-center gap-4 sm:mt-12">
            <span className="h-px w-10 bg-cream/30" aria-hidden />
            <p className="text-caption text-cream/60">
              Shaurya Punj . Co-founding CTO
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
