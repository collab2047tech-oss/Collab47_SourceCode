"use client";

import Link from "next/link";
import { Button } from "@/components/primitives/Button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-bone bg-cream/85 backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <div className="container-edit flex h-16 items-center justify-between">
        <Link
          href="/"
          className="font-serif text-3xl font-normal tracking-tight text-ink"
        >
          Collab47.
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
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
        <Link href="/signup">
          <Button size="sm" variant="primary" className="rounded-full">
            Sign up
          </Button>
        </Link>
      </div>
    </header>
  );
}
