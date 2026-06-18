"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export function CTABand() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section className="bg-ink py-40 md:py-56">
      <div className="container-edit">
        <Reveal>
          <p className="text-caption text-cream/70">Open beta, June 2026</p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-8 max-w-5xl font-serif text-6xl leading-[1.05] text-cream md:text-8xl">
            Start the profile you{" "}
            <span className="italic text-saffron">actually</span> wanted on LinkedIn.
          </h2>
        </Reveal>
        <Reveal delay={0.25}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true);
            }}
            className="mt-16 flex max-w-2xl flex-col gap-4 md:flex-row"
          >
            <Input
              type="email"
              required
              placeholder="you@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-16 border-cream/20 bg-cream/5 text-lg text-cream placeholder:text-cream/50 focus:border-cream"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="bg-saffron text-cream hover:bg-saffron-dk"
            >
              {done ? "You are in." : "Sign up free"}
              {!done && <ArrowRight className="size-5" />}
            </Button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
