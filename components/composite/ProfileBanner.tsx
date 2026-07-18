import { cn } from "@/lib/cn";
import { getBanner } from "@/lib/data/banners";

interface ProfileBannerProps {
  /** Uploaded cover image URL. When set, it wins over the preset. */
  coverUrl?: string | null;
  /** Built-in preset id (used when there is no uploaded cover). */
  bannerPreset?: string | null;
  /** Focal point for an uploaded cover, 0..100 (% from left / top). */
  focalX?: number | null;
  focalY?: number | null;
  /** Extra classes for the outer frame (height, rounding, negative margins). */
  className?: string;
  /** Eager-load the cover image (it is above the fold on profile pages). */
  priority?: boolean;
}

/**
 * The single source of truth for rendering a profile banner. Used by BOTH the
 * owner profile (`/profile`) and the public profile (`/u/[handle]`) so what the
 * owner sets is exactly what a visitor sees.
 *
 * Render order (bottom -> top):
 *   1. Banner layer: uploaded cover (with focal `objectPosition`) OR a preset
 *      (CSS background + optional inline SVG).
 *   2. A bottom-anchored contrast scrim so anything sitting on the lower band of
 *      the banner (avatar, optional on-banner text) stays legible on ANY banner.
 */
export function ProfileBanner({
  coverUrl,
  bannerPreset,
  focalX = 50,
  focalY = 50,
  className,
  priority = false,
}: ProfileBannerProps) {
  const useUpload = Boolean(coverUrl);
  const preset = getBanner(bannerPreset);

  // Clamp the focal point into a safe 0..100 range.
  const fx = Math.min(100, Math.max(0, focalX ?? 50));
  const fy = Math.min(100, Math.max(0, focalY ?? 50));

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[#03265E]",
        className
      )}
    >
      {/* --- Banner layer --- */}
      {useUpload ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={coverUrl as string}
          alt=""
          aria-hidden
          loading={priority ? "eager" : "lazy"}
          // @ts-expect-error fetchPriority is valid DOM but not yet in React types
          fetchpriority={priority ? "high" : undefined}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: `${fx}% ${fy}%` }}
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: preset.background }}
          />
          {preset.svg ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              dangerouslySetInnerHTML={{ __html: preset.svg }}
            />
          ) : null}
        </>
      )}

      {/* --- Contrast scrim (guarantees legibility of anything on the lower band) --- */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,15,28,0.55) 0%, rgba(10,15,28,0.15) 35%, transparent 70%)",
        }}
      />
    </div>
  );
}
