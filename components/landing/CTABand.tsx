"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export function CTABand() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  // Honest CTA: carry the email into the real signup flow (no fake "we'll email
  // you" - there is no waitlist; this creates an account).
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDone(true);
    const q = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
    window.location.href = `/signup${q}`;
  }

  return (
 <section className="bg-ink py-28 sm:py-40 md:py-56">
 <div className="container-edit">
        <Reveal>
 <p className="text-caption text-cream/70">Get started</p>
        </Reveal>
        <Reveal delay={0.1}>
 <h2 className="mt-6 max-w-5xl font-serif text-[2.5rem] leading-[1.06] tracking-tight text-cream sm:mt-8 sm:text-6xl md:text-8xl">
            Start the profile you{" "}
 <span className="text-saffron">actually</span> wanted on LinkedIn.
          </h2>
        </Reveal>
        <Reveal delay={0.18}>
 <p className="mt-6 max-w-2xl text-body text-cream/70 sm:mt-8">
            Build in the open, find collaborators, and connect across India&apos;s
            academia and industry. One platform. Infinite collaborations.
          </p>
        </Reveal>
        <Reveal delay={0.25}>
          <form
            onSubmit={handleSubmit}
 className="mt-10 flex max-w-2xl flex-col gap-3 sm:mt-12 sm:flex-row sm:gap-4"
          >
            <Input
              type="email"
              required
              aria-label="Your email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
 className="h-14 border-cream/20 bg-cream/5 text-lg text-cream placeholder:text-cream/50 focus:border-cream sm:h-16"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
 className="h-14 w-full shrink-0 bg-saffron text-cream hover:bg-saffron-dk sm:h-16 sm:w-auto"
            >
              {done ? "Taking you in." : "Sign up free"}
 {!done && <ArrowRight className="size-5" />}
            </Button>
          </form>
        </Reveal>
        <Reveal delay={0.35}>
          <p
 className="mt-5 text-caption text-cream/50"
            aria-live="polite"
          >
            {done
              ? "Taking you to sign up…"
              : "Free to join. We carry your email straight into sign up."}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
