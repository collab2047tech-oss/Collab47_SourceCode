"use client";

import { SplitWords } from "@/components/motion/SplitWords";
import { Reveal } from "@/components/motion/Reveal";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
 <section className="relative min-h-dvh overflow-hidden bg-cream">
 <div className="container-edit pt-32 sm:pt-40 md:pt-52">
        {/* Caption - English brand line (replaces the Hindi caption) */}
        <Reveal>
 <div className="rule-top mb-8 max-w-md sm:mb-10">
 <p className="text-caption">Connect. Create. Succeed.</p>
          </div>
        </Reveal>

        {/* Headline - clamp down hard on phones so it never overflows at 360px */}
 <h1 className="max-w-[26ch] text-[2.6rem] leading-[1.16] tracking-tight font-serif text-ink pb-[0.08em] sm:text-display-lg md:text-display-xl">
          <SplitWords text="Where talent, innovation" />
          <br />
          <SplitWords text="and opportunity" delay={0.15} />{" "}
          <SplitWords
            text="converge."
            delay={0.3}
            wordClassName="text-saffron"
          />
        </h1>

        {/* Sub - broad: students, researchers, faculty, institutions, industry */}
        <Reveal delay={0.6}>
 <p className="mt-7 max-w-2xl text-body-lg text-ash sm:mt-9">
            India&apos;s collaboration ecosystem for academia and industry.
            Show your work, follow what matters in your field, and team up on
            real projects - from first-year students and researchers to faculty,
            institutions and startups.
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={0.75}>
 <div className="mt-9 flex flex-col items-stretch gap-4 sm:mt-12 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
 <MagneticButton className="w-full sm:w-auto">
              <Link
                href="/signup"
 className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink px-8 text-lg text-cream transition-colors hover:bg-saffron active:scale-[0.98] sm:h-16 sm:w-auto sm:justify-start sm:px-10 sm:text-xl"
              >
                Start your profile
 <ArrowRight className="size-5 sm:size-6" />
              </Link>
            </MagneticButton>
            <Link
              href="#how-it-works"
 className="inline-flex h-12 items-center justify-center gap-2 px-2 text-lg text-ink underline underline-offset-8 decoration-saffron decoration-2 sm:h-16 sm:justify-start sm:text-xl"
            >
              How it works
            </Link>
          </div>
        </Reveal>

        {/* Bottom row - English brand line, no Hindi-only text */}
        <Reveal delay={0.95}>
 <div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-bone pt-8 sm:mt-28 sm:justify-end">
 <p className="text-caption text-ash sm:hidden">Scroll</p>
 <p className="font-serif text-lg text-ink sm:text-xl">
              Collaborate &amp; Innovate for Viksit Bharat 2047.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
