"use client";

import { motion } from "motion/react";

interface MarqueeProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export function Marquee({ children, speed = 40, className }: MarqueeProps) {
  return (
    <div className={`overflow-hidden no-scrollbar ${className ?? ""}`}>
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
