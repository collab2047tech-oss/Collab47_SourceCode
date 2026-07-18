"use client";

import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Reveal } from "@/components/motion/Reveal";
import { SplitWords } from "@/components/motion/SplitWords";

const values = [
  {
    n: "01",
    title: "Merit over pedigree",
    body: "What you have shipped matters more than where you studied. The profile shows the work, and the work argues for itself.",
  },
  {
    n: "02",
    title: "Built in India, for India",
    body: "Vernacular, internet-poor, tier-2 and tier-3 first. If it does not work in Patna on a 4G connection, it does not ship.",
  },
  {
    n: "03",
    title: "Work first, resume never",
    body: "The feed is shipped code, drafts, designs and field notes. A list of titles you once held is not a substitute for proof.",
  },
  {
    n: "04",
    title: "Calm over noisy",
    body: "No streaks, no badges, no rage-bait. The network rewards the slow, considered post over the loud one. Always.",
  },
];

export default function AboutPage() {
  return (
 <main className="min-h-screen bg-cream text-ink">
      <Nav />

      {/* HERO */}
 <section className="section pt-32 sm:pt-40 md:pt-48">
 <div className="container-edit">
          <Reveal>
 <p className="text-caption rule-top inline-block">Who we are</p>
          </Reveal>

          <Reveal delay={0.1}>
 <h1 className="mt-8 max-w-5xl text-[2.5rem] leading-[1.04] tracking-tight font-serif text-ink sm:mt-10 sm:text-display-lg md:text-display-xl">
              <SplitWords text="The missing link" />
              <br />
              <SplitWords
                text="between academia"
                delay={0.25}
                wordClassName="text-saffron"
              />
              <br />
              <SplitWords
                text="and industry."
                delay={0.5}
              />
            </h1>
          </Reveal>

          <Reveal delay={0.6}>
 <div className="mt-16 grid gap-12 md:grid-cols-12">
 <p className="text-body-lg md:col-span-7 md:col-start-1 text-ink/85">
                Collab47 is India&apos;s academia to industry collaboration
                network. We are bootstrap-funded and building the kind of
                product we wished existed when we were starting out, for
                students, researchers, faculty, institutions, and industry.
              </p>
 <p className="text-body md:col-span-4 md:col-start-9 text-ash">
                Founded 2026.<br />
                India.<br />
                Bootstrapped, by design.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* MANIFESTO EXCERPT */}
 <section className="section border-y border-bone bg-paper">
 <div className="container-edit">
          <Reveal>
 <p className="text-caption rule-top inline-block">
              From the manifesto
            </p>
          </Reveal>

 <div className="mt-14 max-w-3xl">
            <Reveal delay={0.1}>
 <blockquote className="font-serif text-[2rem] leading-[1.25] text-ink md:text-[2.5rem] md:leading-[1.2]">
                Every existing professional network was designed for someone
                else. A 40-year-old in San Francisco. A consultant in London.
                A graduate of three institutions in a country that built its
                middle class fifty years before ours.{" "}
 <span className="text-saffron">
                  India does not need a translation of that product.
                </span>{" "}
                It needs its own.
              </blockquote>
            </Reveal>

            <Reveal delay={0.2}>
 <p className="mt-10 text-body-lg text-ink/80">
                Collab47 begins with a single belief. Eighty million Indian
                students are graduating into the largest talent market in the
                world, and the tools they use to find work, find each other,
                and find their first project still treat them like rows in a
                placement-cell spreadsheet.
              </p>
            </Reveal>

            <Reveal delay={0.3}>
 <p className="mt-6 text-body-lg text-ink/80">
                We are building the opposite. A network where a second-year
                from a tier-3 college can publish a working prototype on
                Tuesday and have a conversation with a founder in Bengaluru by
                Friday. Where the unit of identity is not the institution, it
                is the work.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* VALUES */}
 <section className="section bg-ink text-cream">
 <div className="container-edit">
          <Reveal>
 <p className="text-caption rule-top inline-block text-cream/70">
              Founding principles
            </p>
          </Reveal>

          <Reveal delay={0.1}>
 <h2 className="mt-8 max-w-4xl text-[2.25rem] leading-[1.08] tracking-tight font-serif sm:mt-10 sm:text-display-md lg:text-display-lg">
 Four rules we will not <span className="text-saffron">break</span>.
            </h2>
          </Reveal>

 <div className="mt-14 grid grid-cols-1 gap-px bg-cream/15 sm:mt-20 md:grid-cols-2">
            {values.map((v, i) => (
              <Reveal key={v.n} delay={i * 0.1}>
 <div className="flex h-full flex-col gap-5 bg-ink p-8 sm:gap-6 sm:p-10 md:p-12">
 <p className="font-mono text-caption text-saffron">{v.n}</p>
 <h3 className="font-serif text-2xl text-cream sm:text-3xl md:text-4xl">
                    {v.title}
                  </h3>
 <p className="text-body-lg text-cream/75">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
