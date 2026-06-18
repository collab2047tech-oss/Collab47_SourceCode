"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

interface CountUpProps {
  to: number;
  durationMs?: number;
  className?: string;
  format?: (n: number) => string;
}

export function CountUp({
  to,
  durationMs = 1400,
  className,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, durationMs]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {format(val)}
    </span>
  );
}
