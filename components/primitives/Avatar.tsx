"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const sizeClass = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
  "2xl": "size-32 text-3xl",
};

/**
 * Up to two initials from a display name. Hardened against empty strings,
 * leading/trailing/multiple spaces, and emoji-only names so it NEVER returns an
 * empty string (which would render a blank, content-less circle).
 */
function initials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = [...parts[0]][0] ?? "";
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? "") : "";
  const out = (first + last).toUpperCase();
  return out.length > 0 ? out : "?";
}

/**
 * Avatar - image with a GUARANTEED initials fallback.
 *
 * Initials are painted as the base layer and the photo is overlaid on top, so a
 * missing, empty, whitespace, or broken/403 `src` can never produce an empty
 * circle that blends into a banner. On image load error we hide the <img> and
 * the initials show through.
 */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const clean = typeof src === "string" ? src.trim() : "";
  const [failed, setFailed] = useState(false);
  const showImg = clean.length > 0 && !failed;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-bone font-semibold text-ink",
        sizeClass[size],
        className
      )}
      aria-label={name}
    >
      {/* Base layer: always-present initials (never an empty circle). */}
      <span aria-hidden className="absolute inset-0 flex items-center justify-center leading-none">
        {initials(name)}
      </span>
      {/* Photo overlay - hidden on load error so the initials show through. */}
      {clean.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clean}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 size-full rounded-full object-cover", !showImg && "hidden")}
        />
      ) : null}
    </div>
  );
}
