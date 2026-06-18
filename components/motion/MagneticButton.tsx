"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  strength?: number;
}

export function MagneticButton({
  children,
  className,
  href,
  onClick,
  strength = 0.3,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 18 });
  const springY = useSpring(y, { stiffness: 180, damping: 18 });
  const tx = useTransform(springX, (v) => v);
  const ty = useTransform(springY, (v) => v);

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left - rect.width / 2) * strength;
    const offsetY = (e.clientY - rect.top - rect.height / 2) * strength;
    x.set(offsetX);
    y.set(offsetY);
  }
  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const Inner = (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ x: tx, y: ty }}
      className={className}
    >
      {children}
    </motion.div>
  );

  return href ? <a href={href}>{Inner}</a> : Inner;
}
