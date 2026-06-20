"use client";

import { useState, useTransition, useCallback } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, Flag } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportModal } from "@/components/composite/ReportModal";
import { reactToNewsAction, reportNewsAction } from "@/app/(app)/news/actions";
import type { NewsReactionKind } from "@/lib/db/newsEngage";

interface NewsActionsProps {
  newsId: string;
  initialLikeCount: number;
  initialDislikeCount: number;
  commentCount: number;
  myReaction: NewsReactionKind | null;
  compact?: boolean;
}

export function NewsActions({
  newsId,
  initialLikeCount,
  initialDislikeCount,
  commentCount,
  myReaction,
  compact = false,
}: NewsActionsProps) {
  const [reaction, setReaction] = useState<NewsReactionKind | null>(myReaction);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  function applyOptimistic(next: NewsReactionKind | null) {
    // Undo previous reaction counts
    if (reaction === "like") setLikeCount((n) => Math.max(0, n - 1));
    if (reaction === "dislike") setDislikeCount((n) => Math.max(0, n - 1));
    // Apply new
    if (next === "like") setLikeCount((n) => n + 1);
    if (next === "dislike") setDislikeCount((n) => n + 1);
    setReaction(next);
  }

  function handleReact(kind: NewsReactionKind) {
    const next = reaction === kind ? null : kind;
    applyOptimistic(next);
    startTransition(async () => {
      await reactToNewsAction(newsId, next);
    });
  }

  function flagCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    const url = `${window.location.origin}/news/${newsId}`;
    // Prefer the async Clipboard API; fall back to a temporary input + execCommand
    // for browsers/contexts where it's unavailable or rejects (e.g. insecure
    // origin, permission denied). Share must always give feedback.
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
        /* clipboard unavailable — nothing more we can do */
      }
    }
  }

  const handleReport = useCallback(
    async (fd: FormData): Promise<{ ok: boolean; error?: string }> => {
      const category = fd.get("category")?.toString() as
        | "spam"
        | "hate"
        | "sexual"
        | "other";
      const detail = fd.get("body")?.toString();
      if (!category) return { ok: false, error: "Missing category" };
      return reportNewsAction(newsId, category, detail);
    },
    [newsId]
  );

  const btnBase = cn(
    "inline-flex items-center gap-1.5 rounded-full border transition-colors",
    compact
      ? "px-2.5 py-1 text-xs"
      : "px-3.5 py-1.5 text-sm"
  );

  return (
    <>
      <div className={cn("flex items-center gap-2", compact ? "gap-1.5" : "gap-2")}>
        {/* Like */}
        <button
          type="button"
          onClick={() => handleReact("like")}
          aria-label="Like"
          className={cn(
            btnBase,
            reaction === "like"
              ? "border-saffron bg-saffron/10 text-saffron"
              : "border-bone text-ash hover:border-ink hover:text-ink"
          )}
        >
          <ThumbsUp className={compact ? "size-3.5" : "size-4"} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        {/* Dislike */}
        <button
          type="button"
          onClick={() => handleReact("dislike")}
          aria-label="Dislike"
          className={cn(
            btnBase,
            reaction === "dislike"
              ? "border-ember bg-ember/10 text-ember"
              : "border-bone text-ash hover:border-ink hover:text-ink"
          )}
        >
          <ThumbsDown className={compact ? "size-3.5" : "size-4"} />
          {dislikeCount > 0 && <span>{dislikeCount}</span>}
        </button>

        {/* Comments - links to detail page where thread lives */}
        <a
          href={`/news/${newsId}#comments`}
          aria-label="Comments"
          className={cn(
            btnBase,
            "border-bone text-ash hover:border-ink hover:text-ink"
          )}
        >
          <MessageCircle className={compact ? "size-3.5" : "size-4"} />
          {commentCount > 0 && <span>{commentCount}</span>}
        </a>

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share"
          className={cn(
            btnBase,
            copied
              ? "border-moss bg-moss/10 text-moss"
              : "border-bone text-ash hover:border-ink hover:text-ink"
          )}
        >
          <Share2 className={compact ? "size-3.5" : "size-4"} />
          {!compact && <span>{copied ? "Copied!" : "Share"}</span>}
        </button>

        {/* Report */}
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          aria-label="Report"
          className={cn(
            btnBase,
            "border-bone text-ash hover:border-ember hover:text-ember"
          )}
        >
          <Flag className={compact ? "size-3.5" : "size-4"} />
        </button>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={newsId}
        onSubmit={handleReport}
      />
    </>
  );
}
