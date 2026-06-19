"use client";

import { Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { completeOnboarding } from "./actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const interestTiles = [
  "Hackathons", "Design", "Finance", "AI/ML",
  "Hindi memes", "Sports", "Fashion", "Music",
  "Study", "Mentorship", "Startups", "Freelancing",
];

const branches = ["CSE", "ECE", "Mechanical", "Civil", "Electrical", "MBA", "BBA", "BSc", "BA", "BCom", "Design", "Architecture", "Other"];
const years = ["1st", "2nd", "3rd", "4th", "5th", "Postgrad", "Alumni"];

const TOTAL_STEPS = 6; // 0..6
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-cream" />}>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>(0);
  const [handleEdited, setHandleEdited] = useState(false);
  const [data, setData] = useState({
    name: "",
    handle: "",
    college: "",
    city: "",
    branch: "",
    year: "",
    birthdate: "",
    interests: [] as string[],
  });

  // Show the email this account was created with.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const errorParam = params.get("error");
  const errorMsg =
    errorParam === "name" ? "Enter your full name."
      : errorParam === "handle" ? "Username must be 3-32 chars: letters, numbers, underscore."
      : errorParam ? decodeURIComponent(errorParam)
      : null;

  function next() {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1) as Step);
  }
  function back() {
    setStep((s) => Math.max(0, s - 1) as Step);
  }
  function setName(name: string) {
    setData((d) => ({
      ...d,
      name,
      handle: handleEdited ? d.handle : slugify(name),
    }));
  }
  function toggleInterest(i: string) {
    setData((d) => ({
      ...d,
      interests: d.interests.includes(i)
        ? d.interests.filter((x) => x !== i)
        : [...d.interests, i].slice(0, 5),
    }));
  }

  // Per-step "can continue" guard.
  const canContinue =
    step === 0 ? data.name.trim().length > 0 && /^[a-z0-9_]{3,32}$/.test(data.handle)
      : step === 1 ? data.college.trim().length > 0
      : step === 2 ? data.branch.length > 0
      : step === 3 ? data.year.length > 0
      : step === 5 ? data.interests.length >= 3
      : true; // birthdate optional, review always ok

  return (
    <main className="min-h-dvh bg-cream">
      <div className="container-edit flex min-h-dvh flex-col py-10">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl text-ink">
            Collab47.
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            {Array.from({ length: TOTAL_STEPS + 1 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-8 rounded-full transition-colors",
                  i <= step ? "bg-saffron" : "bg-bone"
                )}
              />
            ))}
          </div>
          <span className="text-caption">Step {step + 1} of {TOTAL_STEPS + 1}</span>
        </div>

        {email ? (
          <p className="mt-4 text-center text-sm text-ash">
            Setting up <span className="font-medium text-ink">{email}</span>
          </p>
        ) : null}

        {errorMsg ? (
          <p className="mt-4 rounded-md bg-ember/10 px-4 py-2 text-center text-sm text-ember">
            {errorMsg}
          </p>
        ) : null}

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
                      What is your name?
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      This is how people see you on Collab47.
                    </p>
                    <Input
                      label="Full name"
                      className="mt-8 h-14 text-lg"
                      placeholder="e.g. Shaurya Punj"
                      value={data.name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                    <div className="mt-5">
                      <Input
                        label="Username"
                        className="h-14 text-lg"
                        placeholder="e.g. shaurya_p"
                        value={data.handle}
                        onChange={(e) => {
                          setHandleEdited(true);
                          setData({ ...data, handle: slugify(e.target.value) });
                        }}
                      />
                      <p className="mt-2 text-xs text-ash">
                        collab47.com/u/{data.handle || "username"} . letters, numbers, underscore
                      </p>
                    </div>
                  </div>
                )}
                {step === 1 && (
                  <div>
                    <p className="text-caption">02</p>
                    <h1 className="mt-4 font-serif text-5xl text-ink">
                      Where do you study?
                    </h1>
                    <Input
                      label="College"
                      className="mt-8 h-14 text-lg"
                      placeholder="e.g. Thapar Institute, Patiala"
                      value={data.college}
                      onChange={(e) => setData({ ...data, college: e.target.value })}
                      autoFocus
                    />
                    <Input
                      label="City (optional)"
                      className="mt-5 h-14 text-lg"
                      placeholder="e.g. Patiala"
                      value={data.city}
                      onChange={(e) => setData({ ...data, city: e.target.value })}
                    />
                  </div>
                )}
                {step === 2 && (
                  <div>
                    <p className="text-caption">03</p>
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
                {step === 3 && (
                  <div>
                    <p className="text-caption">04</p>
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
                {step === 4 && (
                  <div>
                    <p className="text-caption">05</p>
                    <h1 className="mt-4 font-serif text-5xl text-ink">
                      When is your birthday?
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Used to verify you are a student. Not shown publicly.
                    </p>
                    <Input
                      label="Date of birth"
                      type="date"
                      className="mt-8 h-14 text-lg"
                      value={data.birthdate}
                      onChange={(e) => setData({ ...data, birthdate: e.target.value })}
                    />
                  </div>
                )}
                {step === 5 && (
                  <div>
                    <p className="text-caption">06 . Pick 3 to 5</p>
                    <h1 className="mt-4 font-serif text-5xl text-ink">
                      What are you into?
                    </h1>
                    <p className="mt-3 text-sm text-ash">
                      Pick at least 3, up to 5.
                    </p>
                    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
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
                {step === 6 && (
                  <div className="text-center">
                    <p className="text-caption">All set</p>
                    <h1 className="mt-4 font-serif text-6xl text-ink">
                      Welcome, <span className="italic text-saffron">{data.name.split(" ")[0] || "friend"}.</span>
                    </h1>
                    <p className="mt-6 text-body-lg text-ash">
                      Review and create your profile.
                    </p>
                    <div className="mx-auto mt-8 max-w-sm rounded-lg border border-bone bg-paper p-5 text-left text-sm">
                      <Row k="Name" v={data.name} />
                      <Row k="Username" v={`@${data.handle}`} />
                      <Row k="College" v={data.college || "-"} />
                      <Row k="Branch" v={data.branch || "-"} />
                      <Row k="Year" v={data.year || "-"} />
                      <Row k="Birthday" v={data.birthdate || "-"} />
                    </div>
                    <form action={completeOnboarding} className="mt-10 inline-block">
                      <input type="hidden" name="name" value={data.name} />
                      <input type="hidden" name="handle" value={data.handle} />
                      <input type="hidden" name="college" value={data.college} />
                      <input type="hidden" name="city" value={data.city} />
                      <input type="hidden" name="branch" value={data.branch} />
                      <input type="hidden" name="year_of_study" value={data.year} />
                      <input type="hidden" name="birthdate" value={data.birthdate} />
                      {data.interests.map((i) => (
                        <input key={i} type="hidden" name="interests" value={i} />
                      ))}
                      <Button type="submit" size="xl" className="rounded-full">
                        Create my profile
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
        {step < TOTAL_STEPS && (
          <div className="flex items-center justify-between border-t border-bone pt-8">
            <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-2">
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button onClick={next} size="lg" disabled={!canContinue} className="gap-2">
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-bone py-2 last:border-0">
      <span className="text-ash">{k}</span>
      <span className="truncate font-medium text-ink">{v}</span>
    </div>
  );
}
