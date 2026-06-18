"use client";

import { Reveal } from "@/components/motion/Reveal";

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
  {
    label: "Vernacular",
    title: "Sign up in Punjabi. Or just talk to it.",
    body: "Voice fill in Hindi, Bengali, Punjabi. No English-first profile fields. Your bio reads like you, not like a corporate press release.",
  },
];

export function Product() {
  return (
    <section id="how-it-works" className="section bg-paper">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption mb-6">The Product</p>
          <h2 className="text-display-md max-w-4xl text-ink">
            Six features.{" "}
            <span className="italic text-saffron">No incumbent stacks them.</span>
          </h2>
        </Reveal>

        <div className="mt-24 grid gap-x-16 gap-y-24 md:grid-cols-12">
          {features.map((f, i) => (
            <Reveal
              key={f.label}
              delay={(i % 3) * 0.06}
              className="md:col-span-6 lg:col-span-4"
            >
              <article className="flex flex-col gap-4 border-t border-ink pt-6">
                <span className="text-caption">{f.label}</span>
                <h3 className="font-serif text-3xl text-ink">{f.title}</h3>
                <p className="text-body text-ash">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
