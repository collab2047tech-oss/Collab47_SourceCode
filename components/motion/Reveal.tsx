"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
  once?: boolean;
}

export function Reveal({
  children,
  delay = 0,
  className,
  y = 16,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // margin is bottom-only on purpose. A uniform "-80px" shrinks the detection
  // box on ALL sides, including the top, so an element scrolled to the top of
  // the viewport by a #hash jump falls in the dead zone, never registers as in
  // view, and stays at opacity:0 - the "How it works / Who it's for links land
  // on a blank section" bug. Shrinking only the bottom keeps the early-trigger
  // feel while guaranteeing anything already on screen is visible.
  const inView = useInView(ref, { once, margin: "0px 0px -80px 0px" });
  const reduce = useReducedMotion();

  // motion/react animates via inline transforms (not CSS transitions), so the
  // global prefers-reduced-motion CSS safety net does NOT catch it. Guard here:
  // when the user prefers reduced motion, render statically with no offset.
  const offset = reduce ? 0 : y;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: offset }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: reduce ? 0 : 0.7,
        delay: reduce ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  /** Per-child delay step in seconds. */
  step?: number;
  /** Delay before the first child animates, in seconds. */
  delay?: number;
  y?: number;
  once?: boolean;
}

/**
 * Reveals direct children in sequence as the group scrolls into view.
 * Each child fades + rises with an incremental delay. Respects
 * prefers-reduced-motion (renders static, no offset, no delay).
 *
 * Usage: <Stagger><Item/><Item/><Item/></Stagger>
 */
export function Stagger({
  children,
  className,
  step = 0.08,
  delay = 0,
  y = 16,
  once = true,
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  // margin is bottom-only on purpose. A uniform "-80px" shrinks the detection
  // box on ALL sides, including the top, so an element scrolled to the top of
  // the viewport by a #hash jump falls in the dead zone, never registers as in
  // view, and stays at opacity:0 - the "How it works / Who it's for links land
  // on a blank section" bug. Shrinking only the bottom keeps the early-trigger
  // feel while guaranteeing anything already on screen is visible.
  const inView = useInView(ref, { once, margin: "0px 0px -80px 0px" });
  const reduce = useReducedMotion();
  const items = Array.isArray(children) ? children : [children];

  return (
    <div ref={ref} className={className}>
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: reduce ? 0 : y }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: reduce ? 0 : 0.6,
            delay: reduce ? 0 : delay + i * step,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
