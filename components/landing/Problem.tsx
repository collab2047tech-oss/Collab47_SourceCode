"use client";

import { Reveal } from "@/components/motion/Reveal";

const items = [
  {
    n: "01",
    h: "Talent stays invisible.",
    p: "A student in Lucknow ships something real and no one outside their campus ever sees it. 95% of India's talent sits outside the top fifty institutions - and outside the networks that get noticed.",
  },
  {
    n: "02",
    h: "Research runs without direction.",
    p: "Researchers and faculty work on problems that industry would fund and use, while companies solve the same problems alone. The two sides rarely meet early enough to matter.",
  },
  {
    n: "03",
    h: "Hiring is slow and blind.",
    p: "Industry and startups screen on pedigree and resumes because there is nowhere to see what someone has actually built. Strong people are missed; the wrong filters stay in place.",
  },
  {
    n: "04",
    h: "Institutions can't reach industry.",
    p: "Universities want their people connected to real problems, internships, and collaborations. Today that depends on scattered contacts and luck - not a place where the whole ecosystem shows up.",
  },
];

export function Problem() {
  return (
 <section id="who" className="section scroll-mt-24 bg-cream">
 <div className="container-edit">
        <Reveal>
 <p className="text-caption mb-6">The Problem</p>
 <h2 className="text-[2.1rem] leading-[1.12] tracking-tight font-serif max-w-4xl text-ink sm:text-display-md">
            Academia and industry are built to need each other.{" "}
 <span className="text-ash">In India, they barely meet.</span>
          </h2>
 <p className="mt-7 max-w-2xl text-body-lg text-ash sm:mt-8">
            Students and freshers, researchers, faculty, institutions, and
            industry all want the same thing - to find each other and build. The
            problem is the gap between them.
          </p>
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
