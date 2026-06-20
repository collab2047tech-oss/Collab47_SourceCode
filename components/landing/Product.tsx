"use client";

import { Reveal } from "@/components/motion/Reveal";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const features = [
  {
    label: "Portfolio",
    title: "A grid of what you actually built.",
    body: "Pin your repos, design files, deck wins, side projects. Your profile shows the work, not a CV with three internships pasted in 11pt Times New Roman.",
  },
  {
    label: "Feed",
    title: "A feed that knows you're in second year.",
    body: "Open the app, like one hackathon post, and the next ten reshape. Branch, city, and year baked into ranking. Less doom-scroll, more useful.",
  },
  {
    label: "News",
    title: "What today's news does to your placement.",
    body: "The IT export bill, the H1B rule, the Adani earnings call. We turn each one into a one-paragraph note for your branch. Optional. Paid. Worth it.",
  },
  {
    label: "Collabs",
    title: "Real briefs from real companies.",
    body: "An NGO needs a Punjabi-language chatbot. A D2C brand needs ten ad concepts by Friday. Teams form here. Recruiters lurk the output.",
  },
  {
    label: "Leaderboard",
    title: "The Lucknow first-year beats the IIT senior.",
    body: "Scores adjust for resources, not pedigree. The student who built three things in a hostel WiFi outage ranks above the one who optimised their LinkedIn-banner.",
  },
];

export function Product() {
  return (
    <section id="how-it-works" className="section bg-paper">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption mb-6">The Product</p>
          <h2 className="text-[2.1rem] leading-[1.1] tracking-tight font-serif max-w-4xl text-ink sm:text-display-md">
            Five features.{" "}
            <span className="italic text-saffron">No incumbent stacks them.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-x-12 gap-y-12 sm:mt-20 sm:gap-y-16 md:grid-cols-12 lg:gap-x-16">
          {features.map((f, i) => (
            <Reveal
              key={f.label}
              delay={(i % 3) * 0.06}
              className="md:col-span-6 lg:col-span-4"
            >
              <article className="group flex h-full flex-col gap-4 border-t border-ink pt-6 transition-transform duration-300 hover:-translate-y-0.5">
                <span className="text-caption transition-colors group-hover:text-saffron">
                  {f.label}
                </span>
                <h3 className="font-serif text-2xl text-ink sm:text-3xl">
                  {f.title}
                </h3>
                <p className="text-body text-ash">{f.body}</p>
              </article>
            </Reveal>
          ))}

          {/* Closing tile — fills the dead 12-col gutter after the 5th feature
              and wires the section to signup. Real CTA, not placeholder. */}
          <Reveal
            delay={0.12}
            className="md:col-span-6 lg:col-span-4"
          >
            <Link
              href="/signup"
              className="group flex h-full flex-col justify-between gap-8 rounded-xl border border-bone bg-cream p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-saffron/40 sm:p-8"
            >
              <p className="font-serif text-2xl text-ink sm:text-3xl">
                One profile.{" "}
                <span className="italic text-saffron">All five, stacked.</span>
              </p>
              <span className="inline-flex items-center gap-2 text-caption text-ink transition-colors group-hover:text-saffron">
                Start building
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
