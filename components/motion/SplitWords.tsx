"use client";

import { motion } from "motion/react";

interface SplitWordsProps {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  staggerMs?: number;
}

export function SplitWords({
  text,
  className,
  wordClassName,
  delay = 0,
  staggerMs = 60,
}: SplitWordsProps) {
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block overflow-hidden align-baseline"
        >
          <motion.span
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{
              duration: 0.85,
              delay: delay + (i * staggerMs) / 1000,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`inline-block ${wordClassName ?? ""}`}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
