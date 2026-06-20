"use client";

import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Reveal } from "@/components/motion/Reveal";
import { SplitWords } from "@/components/motion/SplitWords";
import { Avatar } from "@/components/primitives/Avatar";
import { CountUp } from "@/components/motion/CountUp";

const founders = [
  {
    name: "Akshpreet",
    role: "CEO and Co-founder",
    equity: "30%",
    bio: "Sets the long arc. Spends his weeks talking to students at three colleges in Punjab so the product never drifts from the people it is built for.",
  },
  {
    name: "SSMallick",
    role: "MD and Chief Growth Officer",
    equity: "28%",
    bio: "Runs the ground game. From campus chapters to founding-class outreach, every early user comes through a system he wrote on paper first.",
  },
  {
    name: "Shaurya Punj",
    role: "CTO and Founding Engineer",
    equity: "21%",
    bio: "Owns the stack end to end. Believes a network for builders should itself be built quietly, in public, with proof you can read in the commit log.",
  },
  {
    name: "Rachit",
    role: "CMO, Academic",
    equity: "11%",
    bio: "Translates between professors, placement cells and 19-year-olds. Knows where the syllabus ends and where real work has to begin.",
  },
  {
    name: "Partha",
    role: "CMO, Industry and CAO",
    equity: "6%",
    bio: "The bridge into companies actually hiring. Brings the recruiter side of the table to a network that has had only one side for too long.",
  },
  {
    name: "Agnivo",
    role: "Advisor to CTO",
    equity: "4%",
    bio: "The senior eye on architecture. Helps a young engineering team make decisions they will still be proud of in three years.",
  },
];

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
              <SplitWords text="Six founders." />
              <br />
              <SplitWords
                text="One India."
                delay={0.25}
                wordClassName="italic text-saffron"
              />
              <br />
              <SplitWords
                text="Built for the generation building 2047."
                delay={0.5}
              />
            </h1>
          </Reveal>

          <Reveal delay={0.6}>
            <div className="mt-16 grid gap-12 md:grid-cols-12">
              <p className="text-body-lg md:col-span-7 md:col-start-1 text-ink/85">
                Collab47 is a work-first professional network for Indian
                students. We are bootstrap-funded, based out of Amritsar, and
                building the kind of product we wished existed when we were in
                our first year of college.
              </p>
              <p className="text-body md:col-span-4 md:col-start-9 text-ash">
                Founded 2026.<br />
                Amritsar, Punjab.<br />
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
                <span className="italic text-saffron">
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

      {/* TEAM */}
      <section className="section">
        <div className="container-edit">
          <Reveal>
            <p className="text-caption rule-top inline-block">The founders</p>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="mt-8 max-w-4xl text-[2.25rem] leading-[1.08] tracking-tight font-serif text-ink sm:mt-10 sm:text-display-md lg:text-display-lg">
              The six people <span className="italic text-saffron">on the hook</span> for this.
            </h2>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-8 max-w-2xl text-body-lg text-ash">
              No outside capital. No advisory board larger than the operating
              team. Equity is held by the people doing the work, in proportion
              to the work being done.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-px bg-bone sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
            {founders.map((f, i) => (
              <Reveal key={f.name} delay={i * 0.05}>
                <article className="group flex h-full flex-col gap-5 border border-transparent bg-paper p-7 transition-all duration-300 hover:-translate-y-1 hover:border-saffron hover:bg-cream sm:gap-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <Avatar
                      name={f.name}
                      size="xl"
                      className="bg-cream group-hover:bg-paper"
                    />
                    <span className="text-caption font-mono text-ash">
                      {f.equity}
                    </span>
                  </div>
                  <div>
                    <p className="font-serif text-[1.75rem] leading-none text-ink sm:text-[2rem]">
                      {f.name}
                    </p>
                    <p className="mt-3 text-caption text-saffron">
                      {f.role}
                    </p>
                  </div>
                  <p className="mt-auto text-body text-ink/75">{f.bio}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section bg-moss text-cream">
        <div className="container-edit">
          <Reveal>
            <p className="text-caption rule-top inline-block text-cream/70">
              Founding principles
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="mt-8 max-w-4xl text-[2.25rem] leading-[1.08] tracking-tight font-serif sm:mt-10 sm:text-display-md lg:text-display-lg">
              Four rules we will not <span className="italic text-saffron">break</span>.
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-px bg-cream/15 sm:mt-20 md:grid-cols-2">
            {values.map((v, i) => (
              <Reveal key={v.n} delay={i * 0.1}>
                <div className="flex h-full flex-col gap-5 bg-moss p-8 sm:gap-6 sm:p-10 md:p-12">
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

      {/* NUMBERS */}
      <section className="section">
        <div className="container-edit">
          <Reveal>
            <p className="text-caption rule-top inline-block">By the numbers</p>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="mt-8 max-w-3xl text-[2.1rem] leading-[1.1] tracking-tight font-serif text-ink sm:mt-10 sm:text-display-md">
              Small on purpose. <span className="italic text-saffron">For now.</span>
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-2 gap-px bg-bone sm:mt-20 md:grid-cols-4">
            {[
              { to: 6, label: "Founders, full-time" },
              { to: 24, label: "Founding-class colleges" },
              { to: 1000, label: "Target users by Q4" },
              { to: 0, label: "Ads on the platform, ever" },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.1}>
                <div className="flex h-full flex-col gap-3 bg-cream p-6 sm:gap-4 sm:p-8 md:p-10">
                  <p className="font-serif text-[3rem] leading-none text-ink sm:text-[4.5rem] md:text-[5.5rem]">
                    <CountUp to={stat.to} />
                  </p>
                  <p className="text-caption text-ash">{stat.label}</p>
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
