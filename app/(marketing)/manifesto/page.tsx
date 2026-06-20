"use client";

import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Reveal } from "@/components/motion/Reveal";

export default function ManifestoPage() {
  return (
    <main className="bg-cream text-ink">
      <Nav />

      {/* ============================================================
          TITLE BLOCK
          ============================================================ */}
      <section className="section pt-28 sm:pt-32 md:pt-40">
        <div className="container-edit">
          <Reveal>
            <p className="text-caption">
              Manifesto. Issue 01. June 2026.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 max-w-5xl text-[2.5rem] leading-[1.05] tracking-tight font-serif sm:mt-8 sm:text-display-lg md:text-display-xl">
              Built where the next 40 million Indians{" "}
              <span className="italic text-saffron">actually are.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-12 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-bone pt-6">
              <p className="text-caption">By</p>
              <p className="font-serif text-h2">
                Akshpreet Singh, <span className="italic">CEO.</span>
              </p>
              <p className="text-body-sm text-ash">
                With the founding team.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          ESSAY BODY
          ============================================================ */}
      <article className="pb-24">
        <div className="container-edit">
          <div className="mx-auto max-w-2xl">
            {/* Dropcap intro paragraph */}
            <Reveal>
              <p
                className="text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                <span className="float-left mr-3 mt-2 font-serif text-7xl leading-none text-saffron">
                  S
                </span>
                omewhere in Lucknow, a second-year B.Com student is teaching
                herself product analytics on a borrowed laptop. In Amritsar, a
                mechanical engineering student is fabricating a working drone
                in his uncle's workshop. In Bhubaneswar, a designer is
                shipping illustration commissions to clients in Berlin she
                will never meet. They are good. They are early. And as far as
                the internet is concerned, none of them exist. The cost of
                being invisible at eighteen is not an inconvenience. It is a
                career, compounded.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <p
                className="mt-8 text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                LinkedIn was not built for them, and it shows. It is a
                platform whose entire grammar assumes a work history these
                students do not yet have. Headlines ask for job titles.
                Profiles measure tenure. Feeds reward people who have already
                arrived. For a nineteen year old in Tier 2 India, opening
                LinkedIn is an exercise in being told, in a hundred small
                ways, that the room is not for them. Corporate. English
                first. Optimised for the already credentialed. It mistakes
                volume for opportunity and a follower count for influence.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <p
                className="mt-8 text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                The Indian student platforms understood the demographic but
                stopped at the listings board. Internshala posts internships.
                Unstop posts competitions. Both are useful, neither is a
                network. There is no persistent identity that travels with
                you across four years of college. There is no portfolio
                layer, no proof of work, no record of who you are becoming.
                When the internship ends, the relationship ends. You return
                to being a resume waiting for the next form to fill.
              </p>
            </Reveal>

            {/* PULL QUOTE 1 */}
            <Reveal delay={0.05}>
              <figure className="my-12 rule-top sm:my-16">
                <blockquote
                  className="text-[1.85rem] leading-[1.12] tracking-tight font-serif italic text-saffron sm:text-display-md"
                  style={{ maxWidth: "22ch" }}
                >
                  The cost of being invisible at eighteen is not an
                  inconvenience. It is a career, compounded.
                </blockquote>
              </figure>
            </Reveal>

            <Reveal>
              <p
                className="text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                Collab47 is the opposite premise. We start with what a student
                actually has: the work. Portfolio first, resume later. Every
                profile is a living record of projects shipped, code written,
                designs published, papers submitted, competitions entered. The
                feed is branch aware, so a third year ECE student in Jalandhar
                sees the people, problems, and openings that are relevant to
                her specifically, not the same generic advice loop that bores
                everyone equally. Underneath sits a career impact engine that
                scores opportunity by what it does for you over time, and an
                anti bias layer that refuses to let pedigree be the only
                signal in the room.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <p
                className="mt-8 text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                We are building this in India because India is the only place
                this story can be told honestly. Forty million students will
                pass through Indian higher education in the next four years.
                The cohort entering college in 2026 is, almost exactly, the
                workforce of Viksit Bharat 2047. The country has decided what
                it wants to be by then. Nobody has decided what infrastructure
                these students will use to get there. We would like that
                infrastructure to be built by Indians, in an Indian language
                and an Indian register, for the way Indian students actually
                study and work and find each other.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <p
                className="mt-8 text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                The pedigree problem is the quiet violence at the centre of
                Indian early career hiring. Roughly five percent of our
                students sit inside the IIT, IIM, and NIT envelope. The other
                ninety five percent are taught, in ways subtle and
                unsubtle, that they are a fallback. Recruiters filter by
                college because it is cheap to filter by college. Founders
                hire from their batch because it is cheap to hire from their
                batch. We think this is a sorting failure dressed up as a
                signal. Collab47 is built to surface merit, not pedigree.
                What you have made, what you can do, who you have helped.
                The rest is footnote.
              </p>
            </Reveal>

            {/* PULL QUOTE 2 */}
            <Reveal delay={0.05}>
              <figure className="my-12 rule-top sm:my-16">
                <blockquote
                  className="text-[1.85rem] leading-[1.12] tracking-tight font-serif italic text-saffron sm:text-display-md"
                  style={{ maxWidth: "24ch" }}
                >
                  We surface merit, not pedigree. The rest is footnote.
                </blockquote>
              </figure>
            </Reveal>

            <Reveal>
              <p
                className="text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                A note on how we are funding this. Collab47 is bootstrapped.
                Six cofounders, our own capital, a small floor in Amritsar,
                and an unreasonable conviction that this is worth doing
                slowly and well. Zero ads on the student surface. No selling
                of student data to coaching cartels. No paid visibility for
                the loud. Real opportunities, vetted, from real companies and
                real labs. When we do raise, it will be from people who
                understand that a student network has to earn the trust of
                students before it earns anything else. Until then, the
                founders pay for the servers.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <p
                className="mt-8 text-body-lg leading-[1.7] text-ink/90"
                style={{ maxWidth: "65ch" }}
              >
                If you are reading this and you are eighteen, or you teach
                someone who is, or you remember being eighteen and broke and
                quietly good at something nobody had seen yet: this is for
                you. We will not get everything right. We will iterate in
                public. We will ship the unglamorous parts. But the bet is
                simple and we are not hedging it. The next generation of
                Indian builders is already here, already working, and waiting
                for a place that takes them seriously on the first day,
                not the fifth year. Collab47 is that place.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <p
                className="mt-10 font-indic text-[2.25rem] leading-tight text-ink sm:text-display-md"
                style={{ maxWidth: "65ch" }}
              >
                शुभम् भवतु.
              </p>
            </Reveal>
          </div>
        </div>
      </article>

      {/* ============================================================
          SIGN-OFF
          ============================================================ */}
      <section className="border-t border-bone bg-paper">
        <div className="container-edit py-20">
          <div className="mx-auto max-w-2xl">
            <Reveal>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p
                    className="font-serif text-4xl italic text-ink sm:text-5xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Akshpreet
                  </p>
                  <p className="mt-3 text-caption">
                    Akshpreet Singh / CEO, Collab47
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-caption">Filed from</p>
                  <p className="mt-2 font-serif text-h2 text-ink">
                    Amritsar . June 2026
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA STRIP
          ============================================================ */}
      <section className="bg-ink text-cream">
        <div className="container-edit py-24 md:py-32">
          <Reveal>
            <div className="flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="text-caption text-cream/60">Closing note</p>
                <h2 className="mt-6 text-[2.25rem] leading-[1.08] tracking-tight font-serif sm:text-display-md lg:text-display-lg">
                  If this resonates,{" "}
                  <span className="italic text-saffron">
                    you belong here.
                  </span>
                </h2>
              </div>

              <Link
                href="/signup"
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-saffron px-8 text-sm font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-[0.98]"
              >
                Claim your handle
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
