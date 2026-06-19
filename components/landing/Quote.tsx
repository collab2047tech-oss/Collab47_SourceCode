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
            Build in the open from day one. The work{" "}
            <span className="italic text-saffron">compounds</span>, and the right
            people find you.
          </blockquote>
        </Reveal>
        <Reveal delay={0.25}>
          <p className="mt-12 text-caption text-cream/60">
            Shaurya Punj . Co-founding CTO
          </p>
        </Reveal>
      </div>
    </section>
  );
}
