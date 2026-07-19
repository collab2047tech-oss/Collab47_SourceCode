"use client";

import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Button } from "@/components/primitives/Button";
import { CollegeCombobox, type ComboboxSource } from "@/components/composite/CollegeCombobox";
import { STARTUP_SECTORS } from "@/lib/data/sectors";
import { ArrowRight, ArrowLeft, Check, GraduationCap, Microscope, BookOpen, Building2, Rocket, Briefcase, Pencil, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { completeOnboarding } from "./actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { AccountType } from "@/lib/supabase/types";
import { Wordmark } from "@/components/brand/Wordmark";

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
  { id: "industry", title: "Industry", blurb: "Hire, sponsor, and ship with talent.", Icon: Briefcase },
  { id: "startup", title: "Startup", blurb: "Build your team and ship your product.", Icon: Rocket },
];

const BRANCHES = [
  "CSE", "IT", "ECE", "EEE", "Electrical", "Mechanical", "Civil", "Chemical",
  "Aerospace", "Biotech", "Metallurgy", "Industrial / Production", "Design",
  "Architecture", "Business / Management", "Commerce", "Economics", "Law",
  "Medicine", "Pharmacy", "Physics", "Chemistry", "Mathematics", "Biology",
  "Data Science / AI", "Other",
];

const YEARS = ["1st", "2nd", "3rd", "4th", "5th", "Postgrad", "Alumni"];

const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Prof", "Er"] as const;

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
  | "interests";

interface TypeConfig {
  affiliationLabel: string;
  affiliationPlaceholder: string;
  affiliationOtherPlaceholder: string;
  fieldLabel: string; // branch-style step heading
  fieldKind: "college" | "organization"; // which column the affiliation maps to
  steps: StepKey[];
}

// Streamlined flow: no "review" step (submit now happens on the interests step),
// and the old "studentDetails" (year + birthday) and "role" steps are folded
// into "field". Counts are now 5/5/5/4/5 (student/researcher/faculty/institution
// /industry).
const TYPE_CONFIG: Record<AccountType, TypeConfig> = {
  student: {
    affiliationLabel: "Institute",
    affiliationPlaceholder: "Search your institute",
    affiliationOtherPlaceholder: "e.g. your institute name",
    fieldLabel: "Pick your branch.",
    fieldKind: "college",
    steps: ["type", "identity", "affiliation", "field", "interests"],
  },
  researcher: {
    affiliationLabel: "Institution / Lab",
    affiliationPlaceholder: "Search your institution or lab",
    affiliationOtherPlaceholder: "e.g. your institution or lab",
    fieldLabel: "Your field or area of research.",
    fieldKind: "college",
    steps: ["type", "identity", "affiliation", "field", "interests"],
  },
  faculty: {
    affiliationLabel: "Institution",
    affiliationPlaceholder: "Search your institution",
    affiliationOtherPlaceholder: "e.g. your institution",
    fieldLabel: "Your department.",
    fieldKind: "college",
    steps: ["type", "identity", "affiliation", "field", "interests"],
  },
  institution: {
    affiliationLabel: "Institution / Organization",
    affiliationPlaceholder: "Search the institution",
    affiliationOtherPlaceholder: "e.g. your organization name",
    fieldLabel: "Focus areas.",
    fieldKind: "organization",
    steps: ["type", "identity", "affiliation", "interests"],
  },
  industry: {
    affiliationLabel: "Company / organization",
    affiliationPlaceholder: "Search your company",
    affiliationOtherPlaceholder: "e.g. Nimbus Labs",
    fieldLabel: "Your industry.",
    fieldKind: "organization",
    steps: ["type", "identity", "affiliation", "field", "interests"],
  },
  startup: {
    affiliationLabel: "Startup name",
    affiliationPlaceholder: "Search or type your startup",
    affiliationOtherPlaceholder: "e.g. Nimbus Labs",
    fieldLabel: "Your sector.",
    fieldKind: "organization",
    steps: ["type", "identity", "affiliation", "field", "interests"],
  },
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

// A tiny per-type flavour word, used only to seed username suggestions like
// "aarav_dev". Not shown anywhere else.
const HANDLE_HINTS: Record<AccountType, string> = {
  student: "dev",
  researcher: "lab",
  faculty: "prof",
  institution: "org",
  industry: "co",
  startup: "labs",
};

const HANDLE_RE = /^[a-z0-9_]{3,32}$/;

// Instagram-style "way out" of a blocked username. Derives candidates from the
// typed handle + the person's name (slugified) + a per-type hint. These are only
// CANDIDATES - each is verified against /api/handle-available before it is ever
// shown, so the canonical (underscore-stripped) uniqueness rule is enforced by
// the server, never re-implemented here. Returns up to 6 well-formed, distinct
// candidates (excluding the handle they already typed).
function generateHandleSuggestions(
  base: string,
  name: string,
  type: AccountType | null
): string[] {
  const b = slugify(base);
  const parts = name.split(/\s+/).map((p) => slugify(p)).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const hint = type ? HANDLE_HINTS[type] : "hq";
  const seed = b || first || "user";
  const two = () => String(Math.floor(Math.random() * 90) + 10); // 10-99

  const raw = [
    last ? `${seed}_${last}` : "",
    `${seed}_${two()}`,
    `${seed}_in`,
    first ? `${first}_${hint}` : "",
    `${seed}${two()}`,
    `${seed}_${hint}`,
    last ? `${first}${last}${two()}` : "",
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    const v = c.slice(0, 32);
    if (!HANDLE_RE.test(v)) continue;
    if (v === b) continue; // do not re-suggest what they already typed
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.slice(0, 6);
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
  title: string;
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
    title: "",
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

  // useActionState keeps ALL answers on screen when the server rejects (e.g. the
  // username was taken). A plain <form action={completeOnboarding}> redirected on
  // error, which remounted this tree and wiped every useState. Only SUCCESS
  // redirects; validation failures RETURN an error and we keep every field.
  const [state, formAction, isSubmitting] = useActionState(completeOnboarding, null);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      const user = data.user;
      setEmail(user?.email ?? "");

      // Prefill from the OAuth identity (Google returns full_name / name +
      // avatar). This is the single biggest lever on "signup in under a minute":
      // a Google user lands on the identity step with their real name and a
      // suggested username already filled, and only has to confirm.
      const meta = (user?.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
      };
      const oauthName = (meta.full_name || meta.name || "").trim();
      if (oauthName) {
        setData((d) =>
          // Never clobber something the person already typed.
          d.name.trim() ? d : { ...d, name: oauthName, handle: d.handle || slugify(oauthName) }
        );
      }
    });
  }, []);

  const errorParam = params.get("error");
  const errorMsg =
    errorParam === "name" ? "Enter your full name."
      : errorParam === "handle" ? "Username must be 3-32 chars: letters, numbers, underscore."
      : errorParam ? decodeURIComponent(errorParam)
      : null;

  const config = data.account_type ? TYPE_CONFIG[data.account_type] : null;
  const steps: StepKey[] = config ? config.steps : ["type"];
  const total = config ? steps.length : 5; // estimated length before a type is chosen
  const currentKey = steps[Math.min(index, steps.length - 1)];
  const isInterests = currentKey === "interests";

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

  // Live username availability. Tells people a username is taken WHILE they type
  // instead of after they finish the whole flow. The server action still enforces
  // uniqueness authoritatively; this is purely to save the round trip.
  const [handleStatus, setHandleStatus] =
    useState<"idle" | "checking" | "ok" | "taken" | "reserved" | "similar">("idle");

  // Username "way out": when the typed handle is blocked, offer up to 3
  // verified-AVAILABLE alternatives as tappable chips. `suggestNonce` lets the
  // "Refresh" affordance regenerate a fresh set (the random 2-digit variants).
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestNonce, setSuggestNonce] = useState(0);
  // Cache of handle -> available? so repeat verifications (e.g. on Refresh, or
  // the same candidate across regenerations) skip the round trip.
  const availabilityCache = useRef<Map<string, boolean>>(new Map());

  const [customInterest, setCustomInterest] = useState("");

  function addCustomInterest() {
    const raw = customInterest.trim().replace(/\s+/g, " ");
    if (!raw) return;
    // Match the preset casing when it is really a preset, so we never store a
    // near-duplicate like "robotics" alongside "Robotics".
    const preset = INTERESTS.find((i) => i.toLowerCase() === raw.toLowerCase());
    const value = preset ?? raw;
    if (data.interests.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setCustomInterest("");
      return;
    }
    if (data.interests.length >= MAX_INTERESTS) return;
    setData({ ...data, interests: [...data.interests, value] });
    setCustomInterest("");
  }

  useEffect(() => {
    const h = data.handle;
    if (!/^[a-z0-9_]{3,32}$/.test(h)) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/handle-available?handle=${encodeURIComponent(h)}`);
        const json = (await res.json()) as { available: boolean; status: string };
        setHandleStatus(
          json.available
            ? "ok"
            : json.status === "reserved"
              ? "reserved"
              : json.status === "similar"
                ? "similar"
                : "taken"
        );
      } catch {
        setHandleStatus("idle");
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [data.handle]);

  // Generate + verify username alternatives whenever the current handle is
  // blocked. We fetch candidates in parallel against the SAME availability
  // endpoint the live check uses, so "available:true" already guarantees the
  // candidate clears format, reserved, taken AND canonical-similar - we invent
  // no local canonical logic. First 3 that verify available are shown.
  useEffect(() => {
    const blocked =
      handleStatus === "taken" ||
      handleStatus === "similar" ||
      handleStatus === "reserved";

    if (!blocked || !handleValid) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestLoading(true);
    setSuggestions([]);

    const candidates = generateHandleSuggestions(
      data.handle,
      data.name,
      data.account_type
    );

    (async () => {
      const results = await Promise.all(
        candidates.map(async (c) => {
          const cached = availabilityCache.current.get(c);
          if (cached !== undefined) return { c, ok: cached };
          try {
            const res = await fetch(
              `/api/handle-available?handle=${encodeURIComponent(c)}`
            );
            const json = (await res.json()) as { available: boolean };
            const ok = !!json.available;
            availabilityCache.current.set(c, ok);
            return { c, ok };
          } catch {
            return { c, ok: false };
          }
        })
      );
      if (cancelled) return;
      const available: string[] = [];
      for (const r of results) {
        if (r.ok && !available.includes(r.c)) available.push(r.c);
      }
      setSuggestions(available.slice(0, 3));
      setSuggestLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // data.name is intentionally NOT a dep: retyping the name should not thrash
    // suggestions mid-flow. Regeneration is driven by the handle, its status,
    // and the explicit Refresh (suggestNonce).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleStatus, handleValid, data.handle, data.account_type, suggestNonce]);

  const affiliationValue = usesOrganization ? data.organization : data.college;
  const usesRole = data.account_type === "industry" || data.account_type === "startup";

  // Which directory the affiliation combobox searches, per account type.
  //  student / researcher / faculty / institution -> institution index
  //  startup                                       -> startup index
  //  industry                                      -> plain free text (no index):
  //    industry companies are NOT DPIIT startups, so the startup index is wrong
  //    for them; an MCA / corporate dataset is the future home for this.
  const affiliationSource: ComboboxSource = (() => {
    switch (data.account_type) {
      case "startup":
        return { kind: "startup" };
      case "industry":
        return { kind: "none" };
      default:
        // student / researcher / faculty / institution (and the null pre-choice)
        return { kind: "institution" };
    }
  })();

  // Field-step chips: startups and industry pick a real SECTOR; everyone else
  // (student / researcher / faculty) keeps the academic branch list.
  const fieldOptions =
    data.account_type === "startup" || data.account_type === "industry"
      ? STARTUP_SECTORS
      : BRANCHES;
  const canContinue = (() => {
    switch (currentKey) {
      case "type":
        return !!data.account_type;
      case "identity":
        return (
          data.name.trim().length > 0 &&
          handleValid &&
          handleStatus !== "taken" &&
          handleStatus !== "reserved" &&
          handleStatus !== "similar"
        );
      case "affiliation":
        return affiliationValue.trim().length > 0;
      case "field":
        // Merged step: validate what each type requires. Previously-optional
        // fields (birthday) stay optional.
        if (data.account_type === "student")
          return effectiveBranch.length > 0 && data.year.length > 0;
        if (usesRole)
          return effectiveBranch.length > 0 && data.role.trim().length > 0;
        return effectiveBranch.length > 0;
      case "interests":
        return data.interests.length >= MIN_INTERESTS;
      default:
        return true;
    }
  })();

  // One consistent mechanism so Continue is NEVER silently disabled: when the
  // current step's gate fails, name exactly what is still missing in a quiet
  // ash hint next to the button (rendered in both the nav and the submit form).
  const gateHint: string | null = (() => {
    if (canContinue) return null;
    switch (currentKey) {
      case "identity":
        if (!data.name.trim()) return "Enter your name to continue.";
        if (!handleValid) return "Pick a username (3-32 letters, numbers, or underscore).";
        if (handleStatus === "taken") return "That username is taken. Try another.";
        if (handleStatus === "reserved") return "That username is reserved. Try another.";
        if (handleStatus === "similar") return "That username is too close to an existing one. Add a word.";
        return "Add your name and username to continue.";
      case "affiliation":
        if (data.account_type === "student") return "Pick your institute or type its name.";
        if (data.account_type === "startup") return "Add your startup name.";
        if (usesOrganization) return "Add your organization name.";
        return "Pick your institution or type its name.";
      case "field":
        if (data.account_type === "student") {
          if (!effectiveBranch) return "Pick your branch, or choose Other to type it.";
          if (!data.year) return "Pick your year of study.";
        }
        if (usesRole) {
          if (!effectiveBranch)
            return data.account_type === "startup" ? "Pick your sector." : "Pick your industry.";
          if (!data.role.trim()) return "Add your role.";
        }
        if (!effectiveBranch) return "Choose one, or pick Other to type your own.";
        return "Fill in the details above to continue.";
      case "interests":
        return `Pick at least ${MIN_INTERESTS} (${data.interests.length} selected so far).`;
      default:
        return null;
    }
  })();

  const stepNumber = (k: StepKey) => steps.indexOf(k) + 1;
  const pad = (n: number) => n.toString().padStart(2, "0");

  // Enter advances to the next step when the current step is valid. Attached only
  // to plain text inputs - the combobox and the custom-interest field own their
  // Enter key (select option / add interest), so they are left untouched.
  function advanceOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canContinue) next();
    }
  }

  // Animated progress fill (decorative; the "Step X of Y" text is the a11y
  // source of truth). Respects reduced motion.
  const progressPct = total > 0 ? (Math.min(index + 1, total) / total) * 100 : 0;

  return (
    <main className="min-h-dvh bg-cream">
      <div className="container-edit flex min-h-dvh flex-col py-8 sm:py-10">
        {/* Header + progress */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-2xl text-ink">
            <Wordmark />
          </Link>
          <div className="hidden flex-1 px-6 sm:block" aria-hidden="true">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bone">
              <motion.div
                className="h-full rounded-full bg-saffron"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
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

        <div aria-live="polite">
          {errorMsg ? (
            <p className="mx-auto mt-4 max-w-2xl rounded-lg border border-ember/30 bg-ember/10 px-4 py-2.5 text-center text-sm font-medium text-ember">
              {errorMsg}
            </p>
          ) : null}
        </div>

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
                            aria-pressed={active}
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
                        className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-lg text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                        placeholder={
                          data.account_type === "institution" ? "e.g. Riverside Robotics Society"
                            : data.account_type === "industry" ? "e.g. Nimbus Labs"
                            : "e.g. Aarav Mehta"
                        }
                        value={data.name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={advanceOnEnter}
                        autoFocus
                      />
                    </div>
                    <div className="mt-5 flex flex-col gap-2">
                      <label className="text-caption text-ink">Title (optional)</label>
                      <div className="flex flex-wrap gap-2">
                        {TITLES.map((t) => {
                          const active = data.title === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setData({ ...data, title: active ? "" : t })}
                              className={cn(
                                "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                                active
                                  ? "border-saffron bg-saffron text-cream"
                                  : "border-bone bg-paper text-ink hover:border-saffron hover:text-saffron-dk"
                              )}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-2">
                      <label htmlFor="ob-handle" className="text-caption text-ink">Username</label>
                      <input
                        id="ob-handle"
                        className={cn(
                          "h-14 w-full rounded-lg border bg-paper px-4 text-lg text-ink placeholder:text-ash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20",
                          data.handle && (!handleValid || handleStatus === "taken" || handleStatus === "reserved" || handleStatus === "similar")
                            ? "border-ember focus:border-ember"
                            : "border-ink/15 focus:border-saffron"
                        )}
                        placeholder="e.g. aarav_builds"
                        value={data.handle}
                        onChange={(e) => {
                          setHandleEdited(true);
                          setData({ ...data, handle: slugify(e.target.value) });
                        }}
                        onKeyDown={advanceOnEnter}
                      />
                      <p className="text-xs text-ash">
                        collab47.com/u/<span className="font-medium text-ink">{data.handle || "username"}</span>
                        {"  -  "}letters, numbers, underscore
                      </p>
                      <div aria-live="polite" role="status">
                        {handleValid && handleStatus !== "idle" ? (
                          <p
                            className={cn(
                              "text-xs font-medium",
                              handleStatus === "ok" && "text-moss",
                              handleStatus === "checking" && "text-ash",
                              (handleStatus === "taken" || handleStatus === "reserved" || handleStatus === "similar") && "text-ember"
                            )}
                          >
                            {handleStatus === "checking" && "Checking availability..."}
                            {handleStatus === "ok" && `@${data.handle} is available`}
                            {handleStatus === "taken" && `@${data.handle} is already taken. Try another.`}
                            {handleStatus === "reserved" && `@${data.handle} is reserved. Try another.`}
                            {handleStatus === "similar" && `@${data.handle} is too close to an existing username. Try adding a word.`}
                          </p>
                        ) : null}
                      </div>

                      {/* The way OUT: when the handle is blocked, offer up to 3
                          verified-AVAILABLE alternatives as tappable chips so a
                          username step never dead-ends. Tapping one sets the
                          input, which re-triggers the normal debounced check. */}
                      {handleValid &&
                      (handleStatus === "taken" ||
                        handleStatus === "reserved" ||
                        handleStatus === "similar") ? (
                        <div className="mt-1" aria-live="polite">
                          {suggestLoading ? (
                            <div className="flex flex-wrap gap-2" aria-hidden="true">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="h-11 w-28 animate-pulse rounded-full bg-bone motion-reduce:animate-none"
                                />
                              ))}
                            </div>
                          ) : suggestions.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs text-ash">Available instead:</p>
                              <div className="flex flex-wrap items-center gap-2">
                                {suggestions.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    aria-label={`Use username ${s}`}
                                    onClick={() => {
                                      setHandleEdited(true);
                                      setData((d) => ({ ...d, handle: slugify(s) }));
                                    }}
                                    className="inline-flex min-h-11 items-center rounded-full border border-bone bg-paper px-4 text-sm font-medium text-ink transition-colors hover:border-saffron hover:text-saffron-dk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30"
                                  >
                                    @{s}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setSuggestNonce((n) => n + 1)}
                                  aria-label="Refresh username suggestions"
                                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30"
                                >
                                  <RefreshCw className="size-3.5" /> Refresh
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
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
                        : data.account_type === "industry" ? "Your company."
                        : data.account_type === "startup" ? "Your startup."
                        : "Where are you based?"}
                    </h1>
                    <p className="mt-3 text-body text-ash">
                      Search the list, or add your own if it is not there.
                    </p>
                    <div className="relative mt-8">
                      <CollegeCombobox
                        source={affiliationSource}
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
                    {/* Asked of every account type now. Researchers, faculty and
                        industry were previously never asked, and the server dropped
                        the value even if it had been sent. */}
                    <div className="mt-5 flex flex-col gap-2">
                        <label htmlFor="ob-city" className="text-caption text-ink">
                          {data.account_type === "institution" ? "Location / city" : "Where are you based?"}
                        </label>
                        <input
                          id="ob-city"
                          className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                          placeholder="e.g. your city"
                          value={data.city}
                          onChange={(e) => setData({ ...data, city: e.target.value })}
                          onKeyDown={advanceOnEnter}
                        />
                    </div>
                  </div>
                )}

                {/* ----- Field / branch-style cards (+ merged year+birthday for
                    students, + merged role for industry) ----- */}
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
                      {fieldOptions.map((b, i) => {
                        const active = data.branch === b;
                        return (
                          <button
                            key={b}
                            type="button"
                            aria-pressed={active}
                            autoFocus={i === 0}
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
                                className="h-14 w-full rounded-lg border border-ink/15 bg-paper pl-11 pr-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                                placeholder="e.g. Materials Engineering"
                                value={data.branchOther}
                                onChange={(e) => setData({ ...data, branchOther: e.target.value })}
                                onKeyDown={advanceOnEnter}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Merged from the old "studentDetails" step: year + birthday. */}
                    {data.account_type === "student" && (
                      <>
                        <div className="mt-10">
                          <p className="text-caption text-ink">Year of study</p>
                          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {YEARS.map((y) => {
                              const active = data.year === y;
                              return (
                                <button
                                  key={y}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => setData({ ...data, year: y })}
                                  className={cn(
                                    "rounded-xl border px-4 py-4 text-base font-medium transition-all duration-150",
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
                        </div>
                        <div className="mt-6 flex flex-col gap-2">
                          <label htmlFor="ob-bday" className="text-caption text-ink">
                            Birthday (optional)
                          </label>
                          <input
                            id="ob-bday"
                            type="date"
                            className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                            value={data.birthdate}
                            onChange={(e) => setData({ ...data, birthdate: e.target.value })}
                            onKeyDown={advanceOnEnter}
                          />
                          <p className="text-xs text-ash">Not shown publicly. Helps confirm you are a student.</p>
                        </div>
                      </>
                    )}

                    {/* Merged from the old "role" step: industry job title, and
                        the startup founder's role at their startup. */}
                    {usesRole && (
                      <div className="mt-10 flex flex-col gap-2">
                        <label htmlFor="ob-role" className="text-caption text-ink">
                          {data.account_type === "startup" ? "Your role" : "Role / title"}
                        </label>
                        <input
                          id="ob-role"
                          className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-lg text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                          placeholder={
                            data.account_type === "startup"
                              ? "e.g. Founder, Co-founder, CTO, Engineer"
                              : "e.g. Founder, Talent Lead, Product Manager"
                          }
                          value={data.role}
                          onChange={(e) => setData({ ...data, role: e.target.value })}
                          onKeyDown={advanceOnEnter}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ----- Interests (final, submitting step) ----- */}
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
                      {INTERESTS.map((t, i) => {
                        const active = data.interests.includes(t);
                        const atMax = !active && data.interests.length >= MAX_INTERESTS;
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={active}
                            autoFocus={i === 0}
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

                    {/* Anything they picked that is not one of the presets, so a
                        custom interest stays visible and removable. */}
                    {data.interests.filter((i) => !INTERESTS.includes(i)).length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {data.interests
                          .filter((i) => !INTERESTS.includes(i))
                          .map((i) => (
                            <button
                              key={i}
                              type="button"
                              aria-label={`Remove ${i}`}
                              onClick={() => toggleInterest(i)}
                              className="flex items-center gap-2 rounded-full border border-saffron bg-saffron px-4 py-2 text-sm font-medium text-cream"
                            >
                              {i}
                              <X className="size-3.5" />
                            </button>
                          ))}
                      </div>
                    ) : null}

                    {/* Type your own. The preset grid can never cover every field. */}
                    <div className="mt-5 flex flex-col gap-2">
                      <label htmlFor="ob-custom-interest" className="text-caption text-ink">
                        Not listed? Add your own
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="ob-custom-interest"
                          className="h-12 w-full rounded-lg border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
                          placeholder="e.g. Quantum computing"
                          value={customInterest}
                          maxLength={40}
                          onChange={(e) => setCustomInterest(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomInterest();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={addCustomInterest}
                          disabled={
                            !customInterest.trim() || data.interests.length >= MAX_INTERESTS
                          }
                        >
                          Add
                        </Button>
                      </div>
                      {data.interests.length >= MAX_INTERESTS ? (
                        <p className="text-xs text-ash">
                          That is the maximum of {MAX_INTERESTS}. Remove one to add another.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Nav */}
        <div className="border-t border-bone pt-7">
          {isInterests ? (
            // The interests step is now the final, submitting step. The submit
            // machinery (useActionState above) lives here so a server rejection
            // returns an error inline and every earlier answer stays on screen.
            // FormData contract is byte-identical to the old review step.
            <form action={formAction}>
              <input type="hidden" name="account_type" value={data.account_type ?? ""} />
              <input type="hidden" name="name" value={data.name} />
              <input type="hidden" name="title" value={data.title} />
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
              <div aria-live="polite">
                {state?.error ? (
                  <p className="mb-4 rounded-lg border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember">
                    {state.error}
                    {/username is (taken|too close)/i.test(state.error) ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => goToStep("identity")}
                          className="underline underline-offset-2"
                        >
                          Change username
                        </button>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div aria-live="polite" role="status" className="mb-2 min-h-4 text-right">
                {gateHint ? <span className="text-xs text-ash">{gateHint}</span> : null}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={back}
                  disabled={index === 0}
                  className="gap-2"
                >
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!canContinue || isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? "Creating..." : "Create my profile"} <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div aria-live="polite" role="status" className="mb-2 min-h-4 text-right">
                {gateHint ? <span className="text-xs text-ash">{gateHint}</span> : null}
              </div>
              <div className="flex items-center justify-between gap-4">
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
