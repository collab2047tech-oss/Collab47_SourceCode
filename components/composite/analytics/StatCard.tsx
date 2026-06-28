import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  /** Primary value, already formatted for display. */
  value: string;
  /** Optional secondary line below the value (e.g. "+12 new in 30d"). */
  secondary?: string;
  /** Tone of the secondary line. */
  secondaryTone?: "ash" | "moss" | "saffron";
  className?: string;
}

/**
 * A single overview metric tile. Pure presentation - it receives an already
 * formatted value (en-IN, tabular-nums) so the page stays the single source of
 * formatting truth.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  secondary,
  secondaryTone = "ash",
  className,
}: StatCardProps) {
  const toneClass =
    secondaryTone === "moss"
      ? "text-moss"
      : secondaryTone === "saffron"
        ? "text-saffron-dk"
        : "text-ash";

  return (
    <div
      className={cn(
        "rounded-xl border border-bone bg-paper p-4 transition-colors hover:border-saffron/40",
        className
      )}
    >
      <div className="flex items-center gap-2 text-ash">
        <Icon className="size-4" />
        <span className="text-xs font-medium tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-serif text-2xl text-ink tabular-nums sm:text-3xl">
        {value}
      </p>
      {secondary ? (
        <p className={cn("mt-1 text-xs tabular-nums", toneClass)}>{secondary}</p>
      ) : null}
    </div>
  );
}
