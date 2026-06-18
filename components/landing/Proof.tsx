"use client";

import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { Marquee } from "@/components/motion/Marquee";

const colleges = [
  "Punjabi University",
  "Thapar Institute",
  "GNDU Amritsar",
  "IIT Ropar",
  "DAV Amritsar",
  "Khalsa College",
  "Chitkara University",
  "Lovely Professional",
  "Panjab University",
  "PEC Chandigarh",
];

export function Proof() {
  return (
    <section className="section bg-cream">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption mb-10">Pre-launch</p>
        </Reveal>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          <Reveal>
            <div>
              <div className="font-serif text-display-md text-ink">
                <CountUp to={1000} />+
              </div>
              <p className="mt-2 text-caption">Target users by end of July</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div>
              <div className="font-serif text-display-md text-ink">
                <CountUp to={24} />
              </div>
              <p className="mt-2 text-caption">
                Colleges in the founder distribution network
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div>
              <div className="font-serif text-display-md text-saffron">
                <CountUp to={0} />
              </div>
              <p className="mt-2 text-caption">Ads. Ever.</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="mt-20 border-y border-bone py-10">
            <Marquee speed={36}>
              {colleges.map((c) => (
                <span
                  key={c}
                  className="font-serif text-2xl text-ink/70 md:text-3xl"
                >
                  {c}
                  <span className="ml-12 text-saffron">●</span>
                </span>
              ))}
            </Marquee>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
