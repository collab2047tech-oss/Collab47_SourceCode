"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Smooth-scroll belongs on the marketing pages only. Inside the app (feed,
// news, messages, etc.) we need NATIVE scrolling so inner scroll containers
// and scroll-snap work. Lenis hijacks wheel events globally, which breaks them.
const SMOOTH_PATHS = new Set(["/", "/about", "/manifesto"]);

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

    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [enabled]);

  return <>{children}</>;
}
