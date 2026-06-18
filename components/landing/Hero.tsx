"use client";

import { SplitWords } from "@/components/motion/SplitWords";
import { Reveal } from "@/components/motion/Reveal";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-dvh overflow-hidden bg-cream">
      <div className="container-edit pt-40 md:pt-56">
        {/* Caption */}
        <Reveal>
          <div className="rule-top mb-10 max-w-md">
            <p className="text-caption">
              Issue 01 . Built in India . For India 2026
            </p>
          </div>
        </Reveal>

        {/* Headline */}
        <h1 className="text-display-lg md:text-display-xl text-ink">
          <SplitWords text="The professional network" />
          <br />
          <SplitWords text="Indian students" delay={0.15} />{" "}
          <SplitWords
            text="build first."
            delay={0.3}
            wordClassName="italic text-saffron"
          />
        </h1>

        {/* Sub */}
        <Reveal delay={0.6}>
          <p className="mt-10 max-w-2xl text-body-lg text-ash">
            A profile that shows what you built, a feed that knows your branch,
            and a place to find the three people you actually want to build with.
            For the years before a recruiter has heard your name.
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={0.75}>
          <div className="mt-14 flex flex-wrap items-center gap-5">
            <MagneticButton>
              <Link
                href="/signup"
                className="inline-flex h-16 items-center gap-3 rounded-full bg-ink px-10 text-xl text-cream transition-colors hover:bg-saffron"
              >
                Build your portfolio
                <ArrowRight className="size-6" />
              </Link>
            </MagneticButton>
            <Link
              href="#how-it-works"
              className="inline-flex h-16 items-center gap-2 px-2 text-xl text-ink underline underline-offset-8 decoration-saffron decoration-2"
            >
              How it works
            </Link>
          </div>
        </Reveal>

        {/* Bottom row */}
        <Reveal delay={0.95}>
          <div className="mt-32 flex flex-wrap items-end justify-end gap-6 border-t border-bone pt-8">
            <p className="font-indic text-xl text-ink">
              भारत के विद्यार्थियों के लिए.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
