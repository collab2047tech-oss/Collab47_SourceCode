"use client";

import { ThumbsUp } from "lucide-react";

interface ReactionSummaryProps {
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  /** The viewer's own reaction kind (reserved; aggregate-only data shown here). */
  viewerReaction?: string;
}

/**
 * Honest social-proof row above the action bar. We store only an aggregate like
 * count (not a per-kind breakdown), so we show ONE clean Like glyph + the real
 * total - never a fabricated multi-reaction cluster. LinkedIn-style.
 */
export function ReactionSummary({ likes, comments, reposts, saves }: ReactionSummaryProps) {
  if (likes === 0 && comments === 0 && reposts === 0 && saves === 0) return null;

  const right: string[] = [];
  if (comments > 0) right.push(`${comments.toLocaleString("en-IN")} ${comments === 1 ? "comment" : "comments"}`);
  if (reposts > 0) right.push(`${reposts.toLocaleString("en-IN")} ${reposts === 1 ? "repost" : "reposts"}`);
  if (saves > 0) right.push(`${saves.toLocaleString("en-IN")} saved`);

  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-b border-bone/70 pb-2.5 text-xs text-ash">
      {likes > 0 ? (
        <span className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-full bg-saffron text-cream">
            <ThumbsUp className="size-2.5" strokeWidth={2.5} />
          </span>
          <span className="font-medium text-ink/75">{likes.toLocaleString("en-IN")}</span>
        </span>
      ) : (
        <span />
      )}
      {right.length > 0 ? <span className="truncate">{right.join("  ·  ")}</span> : null}
    </div>
  );
}
