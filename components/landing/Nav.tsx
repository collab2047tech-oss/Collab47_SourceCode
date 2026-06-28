"use client";

import Link from "next/link";
import { Button } from "@/components/primitives/Button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Menu, X, ArrowRight } from "lucide-react";

// Real destinations only (no dead links): landing-section anchors + real pages.
const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#who", label: "Who it's for" },
  { href: "/about", label: "About" },
  { href: "/manifesto", label: "Manifesto" },
];

function Wordmark({ className }: { className?: string }) {
  return (
 <span className={cn("font-serif font-medium tracking-tight text-ink", className)}>
 Collab<span className="text-saffron">47</span>
    </span>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <header
 className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled || open
          ? "border-b border-bone bg-cream/85 backdrop-blur-xl shadow-[0_1px_0_rgba(10,15,28,0.04)]"
          : "bg-transparent"
      )}
    >
 <div className="container-edit flex h-16 items-center justify-between gap-6 sm:h-20">
        {/* Brand */}
 <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <span
            aria-hidden
 className="flex size-8 items-center justify-center rounded-lg bg-ink text-[15px] font-semibold text-cream sm:size-9"
          >
            C
          </span>
 <Wordmark className="text-xl sm:text-2xl" />
        </Link>

        {/* Center nav (desktop) */}
 <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
 className="text-[0.95rem] text-ink/70 transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
 <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
 className="hidden text-[0.95rem] font-medium text-ink/80 transition-colors hover:text-saffron sm:inline-flex"
          >
            Log in
          </Link>
 <Link href="/signup" className="hidden sm:inline-flex">
 <Button size="sm" variant="primary" className="group rounded-full px-5 active:scale-95">
              Get started
 <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
          {/* Mobile: compact CTA + hamburger */}
 <Link href="/signup" className="sm:hidden">
 <Button size="sm" variant="primary" className="rounded-full active:scale-95">
              Get started
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
 className="tap flex items-center justify-center rounded-full border border-bone bg-paper text-ink transition-colors hover:bg-bone active:scale-95 lg:hidden"
          >
 {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open ? (
 <div className="border-t border-bone bg-cream/97 backdrop-blur-xl lg:hidden">
 <nav className="container-edit flex flex-col gap-1 py-4">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
 className="tap flex items-center rounded-xl px-3 text-base text-ink/85 transition-colors hover:bg-bone hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
 <div className="mt-3 flex items-center gap-3 border-t border-bone pt-4">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
 className="tap flex flex-1 items-center justify-center rounded-full border border-bone text-base font-medium text-ink transition-colors hover:bg-bone"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
 className="tap flex flex-1 items-center justify-center rounded-full bg-saffron text-base font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-95"
              >
                Get started
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
