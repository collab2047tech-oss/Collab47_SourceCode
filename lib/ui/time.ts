/**
 * Viewer-locale time helpers. Everything here is computed from the raw ISO
 * timestamp on the CLIENT, so the label reflects the viewer's own clock and
 * timezone (never the server's UTC). Used by the notifications inbox.
 */

/**
 * Short relative label: "now" | "5m" | "2h" | "3d" | "2w" | "Jun 18".
 * For anything older than ~4 weeks it falls back to a short absolute date in
 * the viewer's own locale.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = now - then;
  // Guard against small clock skew so a just-created row never reads negative.
  if (diff < 0) return "now";

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  if (days < 28) return `${Math.floor(days / 7)}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Full local timestamp for the hover/title affordance, in the viewer's locale,
 * e.g. "Thu, 18 Jun 2026, 8:04 PM". Uses `undefined` locale on purpose so the
 * viewer's own formatting + timezone is honoured.
 */
export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type DayBucket = "today" | "yesterday" | "week" | "earlier";

/**
 * Calendar-day bucket key in the viewer's local timezone, for grouping the
 * inbox into "Today" / "Yesterday" / "This week" / "Earlier".
 */
export function dayBucket(iso: string, now: number = Date.now()): DayBucket {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "earlier";
  const nowD = new Date(now);

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 86_400_000;
  const diffDays = Math.round((startOf(nowD) - startOf(then)) / dayMs);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "week";
  return "earlier";
}

export const DAY_BUCKET_LABEL: Record<DayBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  earlier: "Earlier",
};
