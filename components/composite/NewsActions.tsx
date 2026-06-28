"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import {
  Bookmark,
  MessageCircle,
  Share2,
  Flag,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportModal } from "@/components/composite/ReportModal";
import {
  reportNewsAction,
  setNewsSavedAction,
  setNewsTopicSignalAction,
} from "@/app/(app)/news/actions";

interface NewsActionsProps {
  newsId: string;
  commentCount: number;
  initialSaved?: boolean;
  /** Compact = card bottom bar; full = reader page. */
  compact?: boolean;
  /**
   * Optional hook so the InShorts card can also reinforce its instant local
   * loop when the user taps More/Less. The durable DB signal fires regardless.
   */
  onSignal?: (dir: "more" | "less") => void;
  /** Card variant skips Discuss/Report (the card already has a "Read in app"). */
  showDiscuss?: boolean;
  showReport?: boolean;
}

export function NewsActions({
  newsId,
  commentCount,
  initialSaved = false,
  compact = false,
  onSignal,
  showDiscuss = true,
  showReport = true,
}: NewsActionsProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [signal, setSignal] = useState<"more" | "less" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  // ── Save (optimistic) ──────────────────────────────────────────────────
  function handleSave() {
    const next = !saved;
    setSaved(next); // instant
    startTransition(async () => {
      await setNewsSavedAction(newsId, next);
    });
  }

  // ── More / Less like this (optimistic local + durable DB) ──────────────
  function handleSignal(dir: "more" | "less") {
    const next = signal === dir ? null : dir;
    setSignal(next); // instant
    onSignal?.(dir);
    if (next) {
      startTransition(async () => {
        await setNewsTopicSignalAction(newsId, dir);
      });
    }
  }

  // ── Share (clipboard with feedback) ────────────────────────────────────
  function flagCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function handleShare() {
    const url = `${window.location.origin}/news/${newsId}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(flagCopied, fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        flagCopied();
      } catch {
        /* clipboard unavailable - nothing more we can do */
      }
    }
  }

  const handleReport = useCallback(
    async (fd: FormData): Promise<{ ok: boolean; error?: string }> => {
      const category = fd.get("category")?.toString() as "spam" | "hate" | "sexual" | "other";
      const detail = fd.get("body")?.toString();
      if (!category) return { ok: false, error: "Missing category" };
      return reportNewsAction(newsId, category, detail);
    },
    [newsId]
  );

  const iconSize = compact ? "size-4" : "size-[18px]";
  const pill = cn(
    "inline-flex items-center gap-1.5 rounded-full border transition-all active:scale-95",
    compact ? "p-2" : "px-3.5 py-2 text-sm font-medium"
  );
  const labelled = (text: string) => (compact ? null : <span>{text}</span>);

  return (
    <>
      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
        {/* Save - the primary keep signal (replaces voting) */}
        <button
          type="button"
          onClick={handleSave}
          aria-label={saved ? "Saved" : "Save"}
          title={saved ? "Saved" : "Save"}
          aria-pressed={saved}
          className={cn(
            pill,
            saved
              ? "border-saffron bg-saffron/10 text-saffron"
              : "border-bone text-ink/70 hover:border-ink hover:text-ink"
          )}
        >
          <Bookmark className={cn(iconSize, saved && "fill-saffron")} />
          {labelled(saved ? "Saved" : "Save")}
        </button>

        {/* More like this */}
        <button
          type="button"
          onClick={() => handleSignal("more")}
          aria-label="More like this"
          title="More like this"
          aria-pressed={signal === "more"}
          className={cn(
            pill,
            signal === "more"
              ? "border-moss bg-moss/10 text-moss"
              : "border-bone text-ink/70 hover:border-ink hover:text-ink"
          )}
        >
          <ThumbsUp className={iconSize} />
          {labelled("More like this")}
        </button>

        {/* Less like this */}
        <button
          type="button"
          onClick={() => handleSignal("less")}
          aria-label="Less like this"
          title="Less like this"
          aria-pressed={signal === "less"}
          className={cn(
            pill,
            signal === "less"
              ? "border-ember bg-ember/10 text-ember"
              : "border-bone text-ink/70 hover:border-ink hover:text-ink"
          )}
        >
          <ThumbsDown className={iconSize} />
          {labelled("Less like this")}
        </button>

        {/* Discuss - subtle, links to the thread. Count is informational, not "points". */}
        {showDiscuss && (
          <a
            href={`/news/${newsId}#comments`}
            aria-label="Discuss"
            title="Discuss"
            className={cn(pill, "border-bone text-ink/70 hover:border-ink hover:text-ink")}
          >
            <MessageCircle className={iconSize} />
            {compact
              ? commentCount > 0 && <span className="text-xs tabular-nums">{commentCount}</span>
              : <span>Discuss{commentCount > 0 ? ` (${commentCount})` : ""}</span>}
          </a>
        )}

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share"
          title="Share"
          className={cn(
            pill,
            copied
              ? "border-moss bg-moss/10 text-moss"
              : "border-bone text-ink/70 hover:border-ink hover:text-ink"
          )}
        >
          <Share2 className={iconSize} />
          {labelled(copied ? "Copied!" : "Share")}
        </button>

        {/* Overflow -> Report (kept out of the primary row) */}
        {showReport && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              title="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={cn(pill, "border-bone text-ink/70 hover:border-ink hover:text-ink")}
            >
              <MoreHorizontal className={iconSize} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-bone bg-paper shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-cream"
                >
                  <Flag className="size-4 text-ember" />
                  Report this story
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="news"
        targetId={newsId}
        onSubmit={handleReport}
      />
    </>
  );
}
