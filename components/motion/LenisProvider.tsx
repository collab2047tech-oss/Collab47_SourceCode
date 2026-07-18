"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Smooth-scroll belongs on the marketing pages only. Inside the app (feed,
// news, messages, etc.) we need NATIVE scrolling so inner scroll containers
// and scroll-snap work. Lenis hijacks wheel events globally, which breaks them.
const SMOOTH_PATHS = new Set(["/", "/about"]);

// Height of the sticky nav, so an anchored section is not parked underneath it.
const NAV_OFFSET = -96;

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = SMOOTH_PATHS.has(pathname);

  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const id = requestAnimationFrame(raf);

    // Anchor links MUST be routed through Lenis. Lenis owns the scroll position
    // via its RAF loop, so a native #hash jump is immediately overridden on the
    // next frame and the page snaps back - which is exactly why "How it works"
    // and "Who it's for" appeared to do nothing. Intercept same-page hash links
    // and hand them to lenis.scrollTo instead.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Accept "#id" and "/#id" (the nav uses the latter so the links also work
      // from other routes).
      const hash = href.startsWith("#")
        ? href
        : href.startsWith("/#")
          ? href.slice(1)
          : null;
      if (!hash || hash === "#") return;

      const target = document.querySelector(hash);
      if (!target) return;

      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: NAV_OFFSET, duration: 1.1 });
      // Keep the URL in sync without triggering a native jump.
      window.history.pushState(null, "", hash);
    }

    // Landing directly on /#section (external link, refresh, new tab) has the
    // same problem: the browser's native jump loses to Lenis. Re-issue it.
    function jumpToInitialHash() {
      if (!window.location.hash) return;
      const target = document.querySelector(window.location.hash);
      if (!target) return;
      lenis.scrollTo(target as HTMLElement, { offset: NAV_OFFSET, immediate: true });
    }
    const initial = window.setTimeout(jumpToInitialHash, 120);

    document.addEventListener("click", onClick);

    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [enabled]);

  return <>{children}</>;
}
