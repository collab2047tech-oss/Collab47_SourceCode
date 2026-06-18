"use client";

import { motion, useInView } from "motion/react";
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
  const inView = useInView(ref, { once, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
