"use client";

import Link from "next/link";
import { Button } from "@/components/primitives/Button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Menu, X } from "lucide-react";

const MENU_LINKS = [
  { href: "/home", label: "Product" },
  { href: "/explore", label: "Explore" },
  { href: "/news", label: "News" },
  { href: "/login", label: "Log in" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled || open
          ? "border-b border-bone bg-cream/90 backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <div className="container-edit flex h-16 items-center justify-between gap-4 sm:h-18">
        <Link
          href="/"
          className="font-serif text-2xl font-normal tracking-tight text-ink transition-opacity hover:opacity-80 sm:text-3xl"
          onClick={() => setOpen(false)}
        >
          Collab47.
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-9 md:flex">
          <Link
            href="/home"
            className="text-base text-ink/80 transition-colors hover:text-saffron"
          >
            Product
          </Link>
          <Link
            href="/login"
            className="text-base text-ink/80 transition-colors hover:text-saffron"
          >
            Log in
          </Link>
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          {/* Compact Log in stays reachable on small phones too */}
          <Link
            href="/login"
            className="text-sm text-ink/80 transition-colors hover:text-saffron sm:hidden"
          >
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm" variant="primary" className="rounded-full active:scale-95">
              Sign up
            </Button>
          </Link>
          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="tap flex items-center justify-center rounded-full border border-bone bg-paper text-ink transition-colors hover:bg-bone active:scale-95 md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open ? (
        <div className="border-t border-bone bg-cream/95 backdrop-blur-md md:hidden">
          <nav className="container-edit flex flex-col py-3">
            {MENU_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="tap flex items-center rounded-lg px-2 text-base text-ink/85 transition-colors hover:bg-bone hover:text-saffron"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="tap mt-2 flex items-center justify-center rounded-full bg-saffron px-4 text-sm font-medium text-cream transition-colors hover:bg-saffron-dk active:scale-95"
            >
              Sign up
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
