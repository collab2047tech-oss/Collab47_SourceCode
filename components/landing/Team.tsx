"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Avatar } from "@/components/primitives/Avatar";

const team = [
  { name: "Akshpreet", role: "CEO & Co-founder" },
  { name: "SSMallick", role: "MD & Chief Growth Officer" },
  { name: "Shaurya Punj", role: "CTO & Founding CTO" },
  { name: "Rachit", role: "CMO, Academic" },
  { name: "Partha", role: "CMO, Industry & CAO" },
  { name: "Agnivo", role: "Advisor to CTO" },
];

export function Team() {
  return (
    <section className="section bg-paper">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption mb-6">The Team</p>
          <h2 className="text-display-md max-w-3xl text-ink">
            Six founders. Product, growth, academic and industry. Coverage on
            every side.
          </h2>
        </Reveal>

        <div className="mt-20 grid grid-cols-2 gap-px bg-bone md:grid-cols-3 lg:grid-cols-6">
          {team.map((m, i) => (
            <Reveal key={m.name} delay={i * 0.05}>
              <div className="group flex h-full flex-col items-start gap-4 bg-paper p-6 transition-colors hover:bg-saffron">
                <Avatar
                  name={m.name}
                  size="xl"
                  className="bg-cream group-hover:bg-cream"
                />
                <div>
                  <p className="font-serif text-2xl text-ink group-hover:text-cream">
                    {m.name}
                  </p>
                  <p className="mt-1 text-caption text-ash group-hover:text-cream/80">
                    {m.role}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
