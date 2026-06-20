"use client";

import { Reveal } from "@/components/motion/Reveal";

const items = [
  {
    n: "01",
    h: "LinkedIn is for the job you don't have yet.",
    p: "Resume profile, three internship slots, English-first, and a feed of strangers congratulating themselves on promotions. None of it fits a 19-year-old who built a thing last weekend.",
  },
  {
    n: "02",
    h: "Internshala is a noticeboard.",
    p: "Solid listings. Zero community. You go in, find one internship, leave, and forget the site exists until exam season. There is nothing to come back for between applications.",
  },
  {
    n: "03",
    h: "Unstop disappears between hackathons.",
    p: "It is great for the weekend of the event. The Tuesday after, your project, your team, and your work are gone. No place to keep building, no profile that remembers what you shipped.",
  },
  {
    n: "04",
    h: "The Lucknow first-year has no platform.",
    p: "95% of India's students are outside the top 50 colleges. The current platforms reward who already has a recruiter network, not who builds the most interesting thing in their dorm.",
  },
];

export function Problem() {
  return (
    <section className="section bg-cream">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption mb-6">The Problem</p>
          <h2 className="text-[2.1rem] leading-[1.1] tracking-tight font-serif max-w-4xl text-ink sm:text-display-md">
            Indian students juggle five platforms. None of them integrate.{" "}
            <span className="text-ash">None of them were built for them.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-px bg-bone sm:mt-20 md:grid-cols-2">
          {items.map((it, i) => (
            <Reveal key={it.n} delay={i * 0.06} className="bg-cream">
              <div className="group flex h-full flex-col gap-5 p-7 transition-colors hover:bg-paper sm:gap-6 sm:p-8 md:p-12">
                <span className="font-serif text-4xl text-saffron transition-transform duration-300 group-hover:-translate-y-0.5 sm:text-5xl">
                  {it.n}
                </span>
                <h3 className="font-serif text-2xl text-ink sm:text-3xl">
                  {it.h}
                </h3>
                <p className="max-w-md text-body text-ash">{it.p}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
