import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The single source of truth for the Collab47 lockup.
 *
 * Before this existed the wordmark was written by hand in 13 places and had
 * drifted into four different forms ("Collab47.", "Collab" + colored "47",
 * "Collab47 ." and "C47."). Everything renders through here now: real logo mark,
 * capital C, no trailing full stop.
 *
 * The name is set in FULL CAPS ("COLLAB47") to match the pitch decks, and the
 * mark is sized to hold its own beside it. Caps get slightly positive tracking
 * because a serif at tracking-tight reads cramped once it is uppercased.
 */
export interface WordmarkProps {
  className?: string;
  /** Render the interlocking-links mark before the name. */
  withMark?: boolean;
  /** Render only the mark (used where space is tight, e.g. mobile headers). */
  markOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

const TEXT_SIZE = { sm: "text-xl", md: "text-2xl", lg: "text-3xl" } as const;
// Mark sizes bumped so the logo reads as a real brand mark rather than a
// favicon parked next to the name. Kept in step with TEXT_SIZE above.
const MARK_PX = { sm: 30, md: 38, lg: 48 } as const;

export function Wordmark({
  className,
  withMark = true,
  markOnly = false,
  size = "md",
}: WordmarkProps) {
  const px = MARK_PX[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {withMark || markOnly ? (
        <Image
          src="/logo-mark.png"
          alt=""
          width={px}
          height={px}
          className="shrink-0 select-none"
          aria-hidden="true"
        />
      ) : null}
      {markOnly ? (
        <span className="sr-only">Collab47</span>
      ) : (
        <span
          className={cn(
            "font-serif font-medium tracking-[0.01em] text-ink",
            TEXT_SIZE[size]
          )}
        >
          COLLAB47
        </span>
      )}
    </span>
  );
}
