import { cn } from "@/lib/cn";

export interface ChartPoint {
  /** ISO date string (yyyy-mm-dd). */
  day: string;
  value: number;
}

interface MiniChartProps {
  points: ChartPoint[];
  /** Accent color for the line/area/bars. One of the design tokens. */
  color?: "saffron" | "moss";
  /** Render style: smooth area line, or discrete bars. */
  variant?: "area" | "bars";
  /** en-IN formatter applied to the peak label and tooltips. */
  format: (n: number) => string;
  /** Accessible label describing the series. */
  ariaLabel: string;
  className?: string;
}

const COLOR_VAR = {
  saffron: "var(--color-saffron)",
  moss: "var(--color-moss)",
} as const;

const W = 720;
const H = 160;
const PAD_X = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 4;

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Dependency-free reach/engagement chart drawn as a single inline <svg>.
 * Renders an area line (default) or vertical bars over a fixed viewBox that the
 * browser scales responsively. Empty / single-point series are handled by the
 * caller, but we still guard here so a stray empty array can never throw.
 */
export function MiniChart({
  points,
  color = "saffron",
  variant = "area",
  format,
  ariaLabel,
  className,
}: MiniChartProps) {
  const stroke = COLOR_VAR[color];
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  // X for the i-th point, evenly spaced across the inner width.
  const x = (i: number) =>
    n <= 1 ? W / 2 : PAD_X + (innerW * i) / (n - 1);
  const y = (v: number) => PAD_TOP + innerH - (v / max) * innerH;

  const peak = points.reduce(
    (acc, p) => (p.value > acc.value ? p : acc),
    points[0] ?? { day: "", value: 0 }
  );
  const total = points.reduce((s, p) => s + p.value, 0);

  // Smooth-ish path: straight segments are fine at this density and stay crisp.
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`)
    .join(" ");
  const areaPath =
    n > 0
      ? `${linePath} L ${x(n - 1).toFixed(2)} ${(H - PAD_BOTTOM).toFixed(2)} L ${x(0).toFixed(2)} ${(H - PAD_BOTTOM).toFixed(2)} Z`
      : "";

  const barW = n > 0 ? Math.max(2, (innerW / n) * 0.62) : 0;
  const gradId = `grad-${color}-${variant}`;

  return (
    <figure className={cn("min-w-0", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${ariaLabel}. Peak ${format(peak.value)} on ${shortDate(peak.day)}. Total ${format(total)}.`}
        preserveAspectRatio="none"
        className="h-36 w-full"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line
          x1={PAD_X}
          y1={H - PAD_BOTTOM}
          x2={W - PAD_X}
          y2={H - PAD_BOTTOM}
          stroke="var(--color-bone)"
          strokeWidth="1"
        />

        {variant === "bars" ? (
          points.map((p, i) => {
            const bx = x(i) - barW / 2;
            const by = y(p.value);
            return (
              <rect
                key={p.day + i}
                x={bx.toFixed(2)}
                y={by.toFixed(2)}
                width={barW.toFixed(2)}
                height={(H - PAD_BOTTOM - by).toFixed(2)}
                rx="1.5"
                fill={stroke}
                fillOpacity="0.85"
              >
                <title>{`${shortDate(p.day)}: ${format(p.value)}`}</title>
              </rect>
            );
          })
        ) : (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={stroke}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => (
              <circle
                key={p.day + i}
                cx={x(i).toFixed(2)}
                cy={y(p.value).toFixed(2)}
                r="6"
                fill="transparent"
              >
                <title>{`${shortDate(p.day)}: ${format(p.value)}`}</title>
              </circle>
            ))}
          </>
        )}
      </svg>

      {/* Light date axis: first and last day only, to keep it uncluttered. */}
      {n > 0 ? (
        <figcaption className="mt-1.5 flex items-center justify-between text-[11px] text-ash tabular-nums">
          <span>{shortDate(points[0].day)}</span>
          <span className="text-ink/50">Peak {format(peak.value)}</span>
          <span>{shortDate(points[n - 1].day)}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
