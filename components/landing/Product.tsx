"use client";

import { Reveal } from "@/components/motion/Reveal";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const features = [
  {
    label: "Profile",
    title: "A profile that shows the work.",
    body: "Pin your repos, research, design files, decks, and side projects. Whether you're a fresher, a researcher, or faculty, your page leads with what you've actually built - not a CV.",
  },
  {
    label: "Feed",
    title: "A feed personalised to your field.",
    body: "Your branch, your interests, your stage. The smart feed ranks the work and people that matter to you, so opening the app is useful instead of noisy.",
  },
  {
    label: "Collabs",
    title: "Projects and collaborations, in one place.",
    body: "Browse real briefs and projects, apply, and team up. Where talent, innovation, and opportunity converge - across campuses, labs, and startups.",
  },
  {
    label: "Network",
    title: "Follow and connect across the ecosystem.",
    body: "Build a network that spans students, researchers, faculty, and industry. Follow the people doing work you care about and connect when it's time to build together.",
  },
  {
    label: "Messages",
    title: "Talk directly, build directly.",
    body: "Direct messaging turns a follow into a collaboration. Reach out about a project, a brief, or a role without bouncing across five apps and three inboxes.",
  },
  {
    label: "News",
    title: "Stay current on what moves your field.",
    body: "A news feed that keeps you close to the developments shaping your branch and the wider academia-to-industry landscape - context you can actually act on.",
  },
];

export function Product() {
  return (
 <section id="how-it-works" className="section scroll-mt-24 bg-paper">
 <div className="container-edit">
        <Reveal>
 <p className="text-caption mb-6">The Product</p>
 <h2 className="text-[2.1rem] leading-[1.12] tracking-tight font-serif max-w-4xl text-ink sm:text-display-md">
            One platform.{" "}
 <span className="text-saffron">Infinite collaborations.</span>
          </h2>
 <p className="mt-7 max-w-2xl text-body-lg text-ash sm:mt-8">
            Showcase expertise, discover opportunities, and build impactful
            collaborations - here's what you can do on Collab47 today.
          </p>
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

          {/* Closing tile - anchors the grid and wires the section to signup.
              Real CTA, not a placeholder. */}
 <Reveal delay={0.12} className="md:col-span-6 lg:col-span-4">
            <Link
              href="/signup"
 className="group flex h-full flex-col justify-between gap-8 rounded-xl border border-bone bg-cream p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-saffron/40 sm:p-8"
            >
 <p className="font-serif text-2xl text-ink sm:text-3xl">
                Connect talent. Solve real problems.{" "}
 <span className="text-saffron">Build India.</span>
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
