"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";

type NavLink = { href: string; label: string; icon: LucideIcon };

/**
 * Hamburger menu for the signed-in PublicTopNav. Gives mobile users a way to
 * reach the core app destinations from a public page (where the sidebar/bottom
 * nav of AppShell is not present). Hidden on lg+ where inline links show.
 */
export function PublicMobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="tap flex items-center justify-center rounded-full border border-bone bg-paper text-ink transition-colors hover:bg-bone active:scale-95"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open ? (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-ink/20 backdrop-blur-[2px]"
          />
          {/* Sheet */}
          <div className="fixed inset-x-0 top-16 z-50 border-b border-bone bg-cream/95 backdrop-blur-md">
            <nav className="container-edit grid grid-cols-2 gap-2 py-4">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="tap flex items-center gap-3 rounded-lg border border-bone bg-paper px-3 text-sm text-ink/85 transition-colors hover:border-saffron/40 hover:text-saffron active:scale-[0.98]"
                >
                  <l.icon className="size-4 shrink-0" />
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
