"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { completeOnboarding } from "./actions";

const interestTiles = [
  "Hackathons", "Design", "Finance", "AI/ML",
  "Hindi memes", "Sports", "Fashion", "Music",
  "Study", "Mentorship", "Startups", "Freelancing",
];

const branches = ["CSE", "ECE", "Mechanical", "Civil", "Electrical", "MBA", "BBA", "BSc", "BA", "BCom", "Design", "Architecture", "Other"];
const years = ["1st", "2nd", "3rd", "4th", "5th", "Postgrad", "Alumni"];

type Step = 0 | 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [data, setData] = useState({
    college: "",
    branch: "",
    year: "",
    interests: [] as string[],
  });

  function next() {
    setStep((s) => Math.min(4, s + 1) as Step);
  }
  function back() {
    setStep((s) => Math.max(0, s - 1) as Step);
  }
  function toggleInterest(i: string) {
    setData((d) => ({
      ...d,
      interests: d.interests.includes(i)
        ? d.interests.filter((x) => x !== i)
        : [...d.interests, i].slice(0, 5),
    }));
  }

  return (
    <main className="min-h-dvh bg-cream">
      <div className="container-edit flex min-h-dvh flex-col py-10">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl text-ink">
            Collab47.
          </Link>
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-10 rounded-full transition-colors",
                  i <= step ? "bg-saffron" : "bg-bone"
                )}
              />
            ))}
          </div>
          <span className="text-caption">Step {step + 1} of 5</span>
        </div>

        {/* Card */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {step === 0 && (
                  <div>
                    <p className="text-caption">01</p>
                    <h1 className="mt-4 font-serif text-5xl text-ink">
                      Which college are you at?
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Start typing. We will autocomplete.
                    </p>
                    <Input
                      className="mt-10 h-14 text-lg"
                      placeholder="e.g. Punjabi University, Patiala"
                      value={data.college}
                      onChange={(e) =>
                        setData({ ...data, college: e.target.value })
                      }
                    />
                  </div>
                )}
                {step === 1 && (
                  <div>
                    <p className="text-caption">02</p>
                    <h1 className="mt-4 font-serif text-5xl text-ink">
                      Pick your branch.
                    </h1>
                    <div className="mt-10 flex flex-wrap gap-3">
                      {branches.map((b) => (
                        <button
                          key={b}
                          onClick={() => setData({ ...data, branch: b })}
                          className={cn(
                            "rounded-full border px-5 py-3 text-base transition-all",
                            data.branch === b
                              ? "border-saffron bg-saffron text-cream"
                              : "border-ink/15 bg-paper text-ink hover:border-ink"
                          )}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div>
                    <p className="text-caption">03</p>
                    <h1 className="mt-4 font-serif text-5xl text-ink">
                      What year are you in?
                    </h1>
                    <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {years.map((y) => (
                        <button
                          key={y}
                          onClick={() => setData({ ...data, year: y })}
                          className={cn(
                            "rounded-lg border px-5 py-6 text-lg transition-all",
                            data.year === y
                              ? "border-saffron bg-saffron text-cream"
                              : "border-ink/15 bg-paper text-ink hover:border-ink"
                          )}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {step === 3 && (
                  <div>
                    <p className="text-caption">04 . Pick up to 5</p>
                    <h1 className="mt-4 font-serif text-5xl text-ink">
                      What are you into?
                    </h1>
                    <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {interestTiles.map((t) => {
                        const active = data.interests.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => toggleInterest(t)}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-5 py-5 text-base transition-all",
                              active
                                ? "border-saffron bg-saffron text-cream"
                                : "border-ink/15 bg-paper text-ink hover:border-ink"
                            )}
                          >
                            <span>{t}</span>
                            {active ? <Check className="size-4" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {step === 4 && (
                  <div className="text-center">
                    <p className="text-caption">All set</p>
                    <h1 className="mt-4 font-serif text-6xl text-ink">
                      Welcome to{" "}
                      <span className="italic text-saffron">Collab47.</span>
                    </h1>
                    <p className="mt-6 text-body-lg text-ash">
                      Your feed is ready. Your portfolio waits.
                    </p>
                    <form action={completeOnboarding} className="mt-12 inline-block">
                      <input type="hidden" name="handle" defaultValue={(data.college || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) + Math.floor(Math.random() * 1000)} />
                      <input type="hidden" name="name" defaultValue={data.college || "Collab47 user"} />
                      <input type="hidden" name="college" value={data.college} />
                      <input type="hidden" name="branch" value={data.branch} />
                      <input type="hidden" name="year_of_study" value={data.year} />
                      {data.interests.map((i) => (
                        <input key={i} type="hidden" name="interests" value={i} />
                      ))}
                      <Button type="submit" size="xl" className="rounded-full">
                        Enter your feed
                        <ArrowRight className="size-5" />
                      </Button>
                    </form>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Nav buttons */}
        {step < 4 && (
          <div className="flex items-center justify-between border-t border-bone pt-8">
            <Button
              variant="ghost"
              onClick={back}
              disabled={step === 0}
              className="gap-2"
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button onClick={next} size="lg" className="gap-2">
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
