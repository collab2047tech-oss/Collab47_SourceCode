"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  /** Path to copy, relative to the site origin. E.g. "/u/handle" */
  path: string;
  label?: string;
  /** Optional title/text surfaced in the native share sheet. */
  shareTitle?: string;
  shareText?: string;
  className?: string;
}

export function ShareButton({ path, label = "Share", shareTitle, shareText, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — nothing more we can do */
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}${path}`;
    // Prefer the OS share sheet (offers DMs, WhatsApp, etc.) when available.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      } catch {
        // User cancelled or share failed — fall back to copying the link.
      }
    }
    await copyLink(url);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={copied ? "Link copied!" : label}
      className={cn(
        "relative inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
        "border border-bone bg-paper text-ink transition-all duration-150 hover:border-saffron/40 hover:bg-bone",
        "active:scale-95",
        copied && "border-moss/40 text-moss",
        className
      )}
    >
      <Share2
        className={cn("size-4 transition-transform duration-200", copied && "scale-110")}
        strokeWidth={1.75}
      />
      {copied ? (
        <span className="text-moss">Copied!</span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
