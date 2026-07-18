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
 <blockquote className="relative mt-8 max-w-5xl pb-2 font-serif text-[2rem] leading-[1.25] tracking-tight text-cream sm:mt-10 sm:text-4xl sm:leading-[1.22] md:text-6xl md:leading-[1.18]">
            <span
              aria-hidden
 className="pointer-events-none absolute -left-1 -top-8 select-none font-serif text-7xl leading-[1.16] text-saffron/30 sm:-top-10 sm:text-8xl"
            >
              &ldquo;
            </span>
            Where talent, innovation and opportunity{" "}
 <span className="inline-block text-saffron">converge</span>.
            Collaborate and innovate for Viksit Bharat 2047.
          </blockquote>
        </Reveal>
        <Reveal delay={0.25}>
 <div className="mt-10 flex items-center gap-4 sm:mt-12">
 <span className="h-px w-10 bg-cream/30" aria-hidden />
 <p className="text-caption text-cream/60">
              Collab47 &#183; Connect. Create. Succeed.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
