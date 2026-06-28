"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Button } from "@/components/primitives/Button";
import { CollegeCombobox } from "@/components/composite/CollegeCombobox";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  GraduationCap,
  Microscope,
  BookOpen,
  Building2,
  Rocket,
  Pencil,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { completeOnboarding } from "./actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { AccountType } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Static option data (all neutral / generic - no real personal data)
// ---------------------------------------------------------------------------

const ACCOUNT_TYPES: {
  id: AccountType;
  title: string;
  blurb: string;
  Icon: typeof GraduationCap;
}[] = [
  { id: "student", title: "Student", blurb: "Learn, build, and team up with peers.", Icon: GraduationCap },
  { id: "researcher", title: "Researcher", blurb: "Share work, find collaborators, push ideas.", Icon: Microscope },
  { id: "faculty", title: "Faculty", blurb: "Mentor, publish, and guide projects.", Icon: BookOpen },
  { id: "institution", title: "Institution", blurb: "Represent a college, lab, or society.", Icon: Building2 },
  { id: "industry", title: "Industry / Startup", blurb: "Hire, sponsor, and ship with talent.", Icon: Rocket },
];

const BRANCHES = [
  "CSE", "IT", "ECE", "EEE", "Electrical", "Mechanical", "Civil", "Chemical",
  "Aerospace", "Biotech", "Metallurgy", "Industrial / Production", "Design",
  "Architecture", "Business / Management", "Commerce", "Economics", "Law",
  "Medicine", "Pharmacy", "Physics", "Chemistry", "Mathematics", "Biology",
  "Data Science / AI", "Other",
];

const YEARS = ["1st", "2nd", "3rd", "4th", "5th", "Postgrad", "Alumni"];

const INTERESTS = [
  "AI / ML", "Web Dev", "App Dev", "Data Science", "Cybersecurity",
  "Cloud / DevOps", "Blockchain / Web3", "Robotics", "IoT / Embedded",
  "Mechanical / CAD", "Civil / Structures", "Electronics / VLSI",
  "Product / UI-UX", "Design", "Startups", "Entrepreneurship", "Hackathons",
  "Open Source", "Competitive Programming", "Research", "Finance / Fintech",
  "Marketing / Growth", "Content / Writing", "Photography / Film", "Music",
  "Gaming", "Tech memes", "AI memes", "Sports / Fitness", "Public Speaking",
  "Sustainability",
];

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 8;

// ---------------------------------------------------------------------------
// Per-type field labels + step model
// ---------------------------------------------------------------------------

type StepKey =
  | "type"
  | "identity"
  | "affiliation"
  | "field"
  | "studentDetails"
  | "role"
  | "interests"
  | "review";

interface TypeConfig {
  affiliationLabel: string;
  affiliationPlaceholder: string;
  affiliationOtherPlaceholder: string;
  fieldLabel: string; // branch-style step heading
  fieldKind: "college" | "organization"; // which column the affiliation maps to
  steps: StepKey[];
}

const TYPE_CONFIG: Record<AccountType, TypeConfig> = {
  student: {
    affiliationLabel: "College",
    affiliationPlaceholder: "Search your college",
    affiliationOtherPlaceholder: "e.g. your college name",
    fieldLabel: "Pick your branch.",
    fieldKind: "college",
    steps: ["type", "identity", "affiliation", "field", "studentDetails", "interests", "review"],
  },
  researcher: {
    affiliationLabel: "Institution / Lab",
    affiliationPlaceholder: "Search your institution or lab",
    affiliationOtherPlaceholder: "e.g. your institution or lab",
    fieldLabel: "Your field or area of research.",
    fieldKind: "college",
    steps: ["type", "identity", "affiliation", "field", "interests", "review"],
  },
  faculty: {
    affiliationLabel: "Institution",
    affiliationPlaceholder: "Search your institution",
    affiliationOtherPlaceholder: "e.g. your institution",
    fieldLabel: "Your department.",
    fieldKind: "college",
    steps: ["type", "identity", "affiliation", "field", "interests", "review"],
  },
  institution: {
    affiliationLabel: "Institution / Organization",
    affiliationPlaceholder: "Search the institution",
    affiliationOtherPlaceholder: "e.g. your organization name",
    fieldLabel: "Focus areas.",
    fieldKind: "organization",
    steps: ["type", "identity", "affiliation", "interests", "review"],
  },
  industry: {
    affiliationLabel: "Institution / Organization",
    affiliationPlaceholder: "Search the organization",
    affiliationOtherPlaceholder: "e.g. Nimbus Labs",
    fieldLabel: "Your industry.",
    fieldKind: "organization",
    steps: ["type", "identity", "affiliation", "field", "role", "interests", "review"],
  },
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-cream" />}>
      <OnboardingFlow />
    </Suspense>
  );
}

interface FlowData {
  account_type: AccountType | null;
  name: string;
  handle: string;
  // Affiliation: college maps to either college or organization column.
  college: string;
  organization: string;
  city: string;
  // branch-style field (branch / research area / department / industry)
  branch: string;
  branchOther: string; // free text when branch === "Other"
  role: string; // industry job title
  year: string;
  birthdate: string;
  interests: string[];
}

function OnboardingFlow() {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [index, setIndex] = useState(0); // index into the active step list
  const [data, setData] = useState<FlowData>({
    account_type: null,
    name: "",
    handle: "",
    college: "",
    organization: "",
    city: "",
    branch: "",
    branchOther: "",
    role: "",
    year: "",
    birthdate: "",
    interests: [],
  });

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

  const config = data.account_type ? TYPE_CONFIG[data.account_type] : null;
  const steps: StepKey[] = config ? config.steps : ["type"];
  const total = config ? steps.length : 7; // estimated length before a type is chosen
  const currentKey = steps[Math.min(index, steps.length - 1)];
  const isReview = currentKey === "review";

  // Affiliation maps to college vs organization column based on type.
  const usesOrganization = config?.fieldKind === "organization";

  function next() {
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  }
  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }
  function goToStep(key: StepKey) {
    const i = steps.indexOf(key);
    if (i >= 0) setIndex(i);
  }

  function chooseType(t: AccountType) {
    setData((d) => ({ ...d, account_type: t }));
    // Advance after a brief beat so the selection animation reads.
    setIndex(1);
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
        : d.interests.length >= MAX_INTERESTS
          ? d.interests
          : [...d.interests, i],
    }));
  }

  // Effective branch value (handles the Other free-text case).
  const effectiveBranch =
    data.branch === "Other" ? data.branchOther.trim() : data.branch;

  // Per-step continue guard.
  const handleValid = /^[a-z0-9_]{3,32}$/.test(data.handle);
  const affiliationValue = usesOrganization ? data.organization : data.college;
  const canContinue = (() => {
    switch (currentKey) {
      case "type":
        return !!data.account_type;
      case "identity":
        return data.name.trim().length > 0 && handleValid;
      case "affiliation":
        return affiliationValue.trim().length > 0;
      case "field":
        return effectiveBranch.length > 0;
      case "studentDetails":
        return data.year.length > 0; // birthday optional
      case "role":
        return data.role.trim().length > 0;
      case "interests":
        return data.interests.length >= MIN_INTERESTS;
      default:
        return true;
    }
  })();

  const stepNumber = (k: StepKey) => steps.indexOf(k) + 1;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <main className="min-h-dvh bg-cream">
      <div className="container-edit flex min-h-dvh flex-col py-8 sm:py-10">
        {/* Header + progress */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-2xl text-ink">
            Collab47.
          </Link>
          <div className="hidden flex-1 items-center justify-center gap-1.5 px-6 sm:flex">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 max-w-12 rounded-full transition-colors duration-500",
                  i < index ? "bg-saffron"
                    : i === index ? "bg-saffron/60"
                    : "bg-bone"
                )}
              />
            ))}
          </div>
          <span className="shrink-0 text-caption text-ash">
            Step {Math.min(index + 1, total)} of {total}
          </span>
        </div>

        {email ? (
          <p className="mt-4 text-center text-sm text-ash">
            Setting up <span className="font-medium text-ink">{email}</span>
          </p>
        ) : null}

        {errorMsg ? (
          <p className="mx-auto mt-4 max-w-2xl rounded-lg border border-ember/30 bg-ember/10 px-4 py-2.5 text-center text-sm font-medium text-ember">
            {errorMsg}
          </p>
        ) : null}

        {/* Card */}
        <div className="flex flex-1 items-center justify-center py-8">
          <div className={cn("w-full", currentKey === "type" ? "max-w-4xl" : "max-w-2xl")}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentKey}
                initial={reduce ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -24 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* ----- Account type ----- */}
                {currentKey === "type" && (
                  <div>
                    <p className="text-caption text-ash">Welcome to Collab47</p>
                    <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
                      I am joining as a...
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Pick what fits you best. We will tailor the rest.
                    </p>
                    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {ACCOUNT_TYPES.map(({ id, title, blurb, Icon }) => {
                        const active = data.account_type === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => chooseType(id)}
                            className={cn(
                              "group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200",
                              active
                                ? "border-saffron bg-saffron text-cream shadow-lg shadow-saffron/25"
                                : "border-bone bg-paper text-ink hover:border-saffron hover:shadow-md hover:shadow-ink/5"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-11 items-center justify-center rounded-xl transition-colors",
                                active ? "bg-cream/20 text-cream" : "bg-saffron/10 text-saffron-dk group-hover:bg-saffron/15"
                              )}
                            >
                              <Icon className="size-6" />
                            </span>
                            <span className="text-lg font-semibold">{title}</span>
                            <span className={cn("text-sm", active ? "text-cream/90" : "text-ash")}>
                              {blurb}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ----- Identity (name + username) ----- */}
                {currentKey === "identity" && (
                  <div>
                    <p className="text-caption text-ash">{pad(stepNumber("identity"))} / {pad(total)}</p>
                    <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
                      {data.account_type === "institution" || data.account_type === "industry"
                        ? "Name and username."
                        : "What is your name?"}
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      This is how people find and recognize you on Collab47.
                    </p>
                    <div className="mt-8 flex flex-col gap-2">
                      <label htmlFor="ob-name" className="text-caption text-ink">
                        {data.account_type === "institution" ? "Organization name"
                          : data.account_type === "industry" ? "Company / organization name"
                          : "Full name"}
                      </label>
                      <input
                        id="ob-name"
                        className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-lg text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/20"
                        placeholder={
                          data.account_type === "institution" ? "e.g. Riverside Robotics Society"
                            : data.account_type === "industry" ? "e.g. Nimbus Labs"
                            : "e.g. Aarav Mehta"
                        }
                        value={data.name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="mt-5 flex flex-col gap-2">
                      <label htmlFor="ob-handle" className="text-caption text-ink">Username</label>
                      <input
                        id="ob-handle"
                        className={cn(
                          "h-14 w-full rounded-lg border bg-paper px-4 text-lg text-ink placeholder:text-ash transition-colors focus:outline-none focus:ring-2 focus:ring-saffron/20",
                          data.handle && !handleValid ? "border-ember focus:border-ember" : "border-ink/15 focus:border-saffron"
                        )}
                        placeholder="e.g. aarav_builds"
                        value={data.handle}
                        onChange={(e) => {
                          setHandleEdited(true);
                          setData({ ...data, handle: slugify(e.target.value) });
                        }}
                      />
                      <p className="text-xs text-ash">
                        collab47.com/u/<span className="font-medium text-ink">{data.handle || "username"}</span>
                        {"  -  "}letters, numbers, underscore
                      </p>
                    </div>
                  </div>
                )}

                {/* ----- Affiliation (combobox + optional city) ----- */}
                {currentKey === "affiliation" && config && (
                  <div className="relative">
                    <p className="text-caption text-ash">{pad(stepNumber("affiliation"))} / {pad(total)}</p>
                    <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
                      {data.account_type === "student" ? "Where do you study?"
                        : data.account_type === "institution" ? "Tell us about your organization."
                        : data.account_type === "industry" ? "Your organization."
                        : "Where are you based?"}
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Search the list, or add your own if it is not there.
                    </p>
                    <div className="relative mt-8">
                      <CollegeCombobox
                        label={config.affiliationLabel}
                        placeholder={config.affiliationPlaceholder}
                        otherPlaceholder={config.affiliationOtherPlaceholder}
                        value={usesOrganization ? data.organization : data.college}
                        onChange={(v) =>
                          setData((d) =>
                            usesOrganization ? { ...d, organization: v } : { ...d, college: v }
                          )
                        }
                        autoFocus
                      />
                    </div>
                    {(data.account_type === "student" || data.account_type === "institution") && (
                      <div className="mt-5 flex flex-col gap-2">
                        <label htmlFor="ob-city" className="text-caption text-ink">
                          {data.account_type === "institution" ? "Location / city" : "City (optional)"}
                        </label>
                        <input
                          id="ob-city"
                          className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/20"
                          placeholder="e.g. your city"
                          value={data.city}
                          onChange={(e) => setData({ ...data, city: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ----- Field / branch-style cards ----- */}
                {currentKey === "field" && config && (
                  <div>
                    <p className="text-caption text-ash">{pad(stepNumber("field"))} / {pad(total)}</p>
                    <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
                      {config.fieldLabel}
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Choose the closest fit. Pick &quot;Other&quot; to type your own.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-2.5">
                      {BRANCHES.map((b) => {
                        const active = data.branch === b;
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setData({ ...data, branch: b })}
                            className={cn(
                              "rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-150",
                              active
                                ? "border-saffron bg-saffron text-cream shadow-sm shadow-saffron/30"
                                : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk"
                            )}
                          >
                            {b}
                          </button>
                        );
                      })}
                    </div>
                    <AnimatePresence>
                      {data.branch === "Other" && (
                        <motion.div
                          initial={reduce ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={reduce ? undefined : { opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="mt-5 flex flex-col gap-2">
                            <label htmlFor="ob-branch-other" className="text-caption text-ink">
                              Type your own
                            </label>
                            <div className="relative">
                              <Pencil className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
                              <input
                                id="ob-branch-other"
                                autoFocus
                                className="h-14 w-full rounded-lg border border-ink/15 bg-paper pl-11 pr-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/20"
                                placeholder="e.g. Materials Engineering"
                                value={data.branchOther}
                                onChange={(e) => setData({ ...data, branchOther: e.target.value })}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ----- Student details (year + birthday) ----- */}
                {currentKey === "studentDetails" && (
                  <div>
                    <p className="text-caption text-ash">{pad(stepNumber("studentDetails"))} / {pad(total)}</p>
                    <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
                      Year of study.
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Where are you in your journey right now?
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {YEARS.map((y) => {
                        const active = data.year === y;
                        return (
                          <button
                            key={y}
                            type="button"
                            onClick={() => setData({ ...data, year: y })}
                            className={cn(
                              "rounded-xl border px-4 py-5 text-base font-medium transition-all duration-150",
                              active
                                ? "border-saffron bg-saffron text-cream shadow-sm shadow-saffron/30"
                                : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk"
                            )}
                          >
                            {y}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-8 flex flex-col gap-2">
                      <label htmlFor="ob-bday" className="text-caption text-ink">
                        Birthday (optional)
                      </label>
                      <input
                        id="ob-bday"
                        type="date"
                        className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/20"
                        value={data.birthdate}
                        onChange={(e) => setData({ ...data, birthdate: e.target.value })}
                      />
                      <p className="text-xs text-ash">Not shown publicly. Helps confirm you are a student.</p>
                    </div>
                  </div>
                )}

                {/* ----- Role / title (industry) ----- */}
                {currentKey === "role" && (
                  <div>
                    <p className="text-caption text-ash">{pad(stepNumber("role"))} / {pad(total)}</p>
                    <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
                      Your role.
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      What is your title at the organization?
                    </p>
                    <div className="mt-8 flex flex-col gap-2">
                      <label htmlFor="ob-role" className="text-caption text-ink">Role / title</label>
                      <input
                        id="ob-role"
                        autoFocus
                        className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-lg text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/20"
                        placeholder="e.g. Founder, Talent Lead, Product Manager"
                        value={data.role}
                        onChange={(e) => setData({ ...data, role: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* ----- Interests ----- */}
                {currentKey === "interests" && (
                  <div>
                    <p className="text-caption text-ash">
                      {pad(stepNumber("interests"))} / {pad(total)}  -  pick {MIN_INTERESTS} or more
                    </p>
                    <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
                      {data.account_type === "institution" ? "Focus areas." : "What are you into?"}
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Choose at least {MIN_INTERESTS} (up to {MAX_INTERESTS}).{" "}
                      <span className="font-medium text-ink">{data.interests.length} selected</span>
                    </p>
                    <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {INTERESTS.map((t) => {
                        const active = data.interests.includes(t);
                        const atMax = !active && data.interests.length >= MAX_INTERESTS;
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={atMax}
                            onClick={() => toggleInterest(t)}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-sm font-medium transition-all duration-150",
                              active
                                ? "border-saffron bg-saffron text-cream shadow-sm shadow-saffron/30"
                                : atMax
                                  ? "cursor-not-allowed border-bone bg-cream text-ash"
                                  : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk"
                            )}
                          >
                            <span className="truncate">{t}</span>
                            {active ? <Check className="size-4 shrink-0" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ----- Review & Create ----- */}
                {currentKey === "review" && (
                  <ReviewStep
                    data={data}
                    effectiveBranch={effectiveBranch}
                    usesOrganization={usesOrganization}
                    config={config}
                    onEdit={goToStep}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Nav */}
        {!isReview && (
          <div className="flex items-center justify-between gap-4 border-t border-bone pt-7">
            <Button
              variant="ghost"
              onClick={back}
              disabled={index === 0}
              className="gap-2"
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            {currentKey !== "type" ? (
              <Button onClick={next} size="lg" disabled={!canContinue} className="gap-2">
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <span className="text-sm text-ash">Select one to continue</span>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Review step
// ---------------------------------------------------------------------------

function ReviewStep({
  data,
  effectiveBranch,
  usesOrganization,
  config,
  onEdit,
}: {
  data: FlowData;
  effectiveBranch: string;
  usesOrganization: boolean;
  config: TypeConfig | null;
  onEdit: (k: StepKey) => void;
}) {
  const typeMeta = ACCOUNT_TYPES.find((t) => t.id === data.account_type);
  const first = data.name.trim().split(/\s+/)[0] || "there";

  // Build summary rows relevant to this account type.
  const rows = useMemo(() => {
    const r: { key: StepKey; label: string; value: string }[] = [
      { key: "identity", label: "Name", value: data.name },
      { key: "identity", label: "Username", value: `@${data.handle}` },
    ];
    if (config) {
      r.push({
        key: "affiliation",
        label: config.affiliationLabel,
        value: (usesOrganization ? data.organization : data.college) || "-",
      });
    }
    if (data.account_type === "student") {
      r.push({ key: "field", label: "Branch", value: effectiveBranch || "-" });
      r.push({ key: "studentDetails", label: "Year", value: data.year || "-" });
      if (data.city) r.push({ key: "affiliation", label: "City", value: data.city });
      if (data.birthdate) r.push({ key: "studentDetails", label: "Birthday", value: data.birthdate });
    }
    if (data.account_type === "researcher") {
      r.push({ key: "field", label: "Field / area", value: effectiveBranch || "-" });
    }
    if (data.account_type === "faculty") {
      r.push({ key: "field", label: "Department", value: effectiveBranch || "-" });
    }
    if (data.account_type === "institution") {
      if (data.city) r.push({ key: "affiliation", label: "Location", value: data.city });
    }
    if (data.account_type === "industry") {
      r.push({ key: "field", label: "Industry", value: effectiveBranch || "-" });
      r.push({ key: "role", label: "Role", value: data.role || "-" });
    }
    return r;
  }, [data, effectiveBranch, usesOrganization, config]);

  return (
    <div>
      <div className="flex items-center gap-2 text-saffron-dk">
        <Sparkles className="size-4" />
        <p className="text-caption font-semibold">Almost done</p>
      </div>
      <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
        Looking good, <span className="text-saffron">{first}.</span>
      </h1>
      <p className="mt-3 text-body text-ash">
        Review your details, then create your profile. You can edit anything later.
      </p>

      <div className="mt-8 rounded-2xl border border-bone bg-paper p-6 shadow-sm shadow-ink/5 sm:p-8">
        {/* Header card */}
        <div className="flex items-center gap-4 border-b border-bone pb-6">
          <span className="flex size-12 items-center justify-center rounded-xl bg-saffron/10 text-saffron-dk">
            {typeMeta ? <typeMeta.Icon className="size-6" /> : null}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink">{data.name || "Your name"}</p>
            <p className="text-sm text-ash">
              @{data.handle || "username"}  -  {typeMeta?.title ?? "Member"}
            </p>
          </div>
        </div>

        {/* Detail rows */}
        <dl className="mt-2 divide-y divide-bone">
          {rows.map((row, i) => (
            <div key={`${row.label}-${i}`} className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-ash">{row.label}</dt>
              <div className="flex min-w-0 items-center gap-3">
                <dd className="truncate text-sm font-medium text-ink">{row.value}</dd>
                <button
                  type="button"
                  onClick={() => onEdit(row.key)}
                  className="shrink-0 text-xs font-medium text-saffron-dk underline underline-offset-2 hover:text-saffron"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </dl>

        {/* Interests */}
        <div className="mt-4 border-t border-bone pt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ash">Interests</p>
            <button
              type="button"
              onClick={() => onEdit("interests")}
              className="text-xs font-medium text-saffron-dk underline underline-offset-2 hover:text-saffron"
            >
              Edit
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.interests.length ? (
              data.interests.map((i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-saffron/10 px-3 py-1 text-xs font-medium text-saffron-dk"
                >
                  {i}
                </span>
              ))
            ) : (
              <span className="text-sm text-ash">None selected</span>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <form action={completeOnboarding} className="mt-8">
        <input type="hidden" name="account_type" value={data.account_type ?? ""} />
        <input type="hidden" name="name" value={data.name} />
        <input type="hidden" name="handle" value={data.handle} />
        <input type="hidden" name="college" value={usesOrganization ? "" : data.college} />
        <input type="hidden" name="organization" value={usesOrganization ? data.organization : ""} />
        <input type="hidden" name="city" value={data.city} />
        <input type="hidden" name="branch" value={effectiveBranch} />
        <input type="hidden" name="role" value={data.role} />
        <input type="hidden" name="year_of_study" value={data.year} />
        <input type="hidden" name="birthdate" value={data.birthdate} />
        {data.interests.map((i) => (
          <input key={i} type="hidden" name="interests" value={i} />
        ))}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onEdit("interests")}
            className="gap-2"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button type="submit" size="xl" className="rounded-full">
            Create my profile <ArrowRight className="size-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
