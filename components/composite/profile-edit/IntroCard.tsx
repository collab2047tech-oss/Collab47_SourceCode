"use client";

import { useState } from "react";
import { MapPin, GraduationCap, Pencil, CheckCircle2 } from "lucide-react";
import { useEditableProfile } from "./EditableProfileProvider";
import { EditIntroModal } from "./EditIntroModal";

/**
 * Owner identity card. Reads live (optimistic) values from the provider so an
 * intro edit reflects instantly, and carries a pen that opens the inline editor.
 * Mirrors the read-only markup previously rendered on /profile, plus the
 * honorific prefix (now editable) and the token-based verified badge.
 */
export function IntroCard() {
  const { values } = useEditableProfile();
  const [open, setOpen] = useState(false);
  const p = values;

  return (
    <div className="relative rounded-2xl border border-bone bg-paper px-5 py-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit intro"
        className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full border border-bone bg-paper text-ash transition-colors hover:border-saffron hover:text-saffron-dk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron [@media(hover:hover)]:size-10"
      >
        <Pencil className="size-4" strokeWidth={1.75} />
      </button>

      <div className="flex flex-wrap items-center gap-2 pr-12">
        <h1
          className="wrap-break-word font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl md:text-5xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          {p.title ? <span className="text-ash">{p.title} </span> : null}
          {p.name}
        </h1>
        {p.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-saffron">
            <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
            Verified
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-ash">@{p.handle}</p>

      {p.college || p.branch || p.city ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ash">
          {p.college ? (
            <span className="flex items-center gap-1.5">
              <GraduationCap className="size-3.5 shrink-0" strokeWidth={1.75} />
              {p.college}
              {p.branch ? <span className="text-ink">&nbsp;&middot; {p.branch}</span> : null}
              {p.year_of_study ? <span className="text-ink">&nbsp;&middot; &apos;{p.year_of_study}</span> : null}
            </span>
          ) : null}
          {p.city ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
              {p.city}
            </span>
          ) : null}
        </p>
      ) : null}

      {p.bio ? (
        <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink">{p.bio}</p>
      ) : null}

      {open ? <EditIntroModal onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
