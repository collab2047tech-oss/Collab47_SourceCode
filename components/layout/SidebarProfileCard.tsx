"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/primitives/Avatar";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { getBanner } from "@/lib/data/banners";

/** The identity fields AppShell already has in scope (from the layout `me`). */
export interface SidebarProfileMe {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
}

/**
 * The extra fields the LinkedIn-style card wants but AppShell is NOT given.
 * AppShell does not fetch (it receives `me` as a prop from the forbidden
 * layout), so this card fetches its own enrichment client-side, keyed by the
 * signed-in user id. The sidebar is part of the persistent (app) layout, so
 * this mounts once and the read does not repeat on in-app navigation. Every
 * line degrades gracefully: until the read resolves (or if it fails) the card
 * still shows name + handle + avatar from `me`, and any missing line is hidden
 * rather than shown as placeholder text.
 */
interface SidebarProfileExtra {
  branch: string | null;
  college: string | null;
  organization: string | null;
  banner_preset: string | null;
  cover_url: string | null;
  cover_focal_x: number | null;
  cover_focal_y: number | null;
}

export function SidebarProfileCard({
  me,
  className,
}: {
  me: SidebarProfileMe;
  className?: string;
}) {
  const [extra, setExtra] = useState<SidebarProfileExtra | null>(null);

  useEffect(() => {
    let alive = true;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    (async () => {
      const { data } = await sb
        .from("profiles")
        .select(
          "branch, college, organization, banner_preset, cover_url, cover_focal_x, cover_focal_y"
        )
        .eq("id", me.id)
        .maybeSingle();
      if (alive && data) setExtra(data as SidebarProfileExtra);
    })();
    return () => {
      alive = false;
    };
  }, [me.id]);

  // Headline = branch/field/role; institute = college (students/academia) or
  // organization (industry/institution). Both hide when absent - no "Add a
  // headline" placeholders in wave 1.
  const headline = extra?.branch?.trim() || null;
  const institute = extra?.college?.trim() || extra?.organization?.trim() || null;

  // Banner thumb: an uploaded cover wins; otherwise the chosen preset (or the
  // default preset). Reimplemented inline (ProfileBanner is read-only) since the
  // card only needs a small strip, not the full scrim/priority machinery.
  const coverUrl = extra?.cover_url?.trim() || null;
  const preset = getBanner(extra?.banner_preset);
  const fx = Math.min(100, Math.max(0, extra?.cover_focal_x ?? 50));
  const fy = Math.min(100, Math.max(0, extra?.cover_focal_y ?? 50));

  return (
    <Link
      href="/profile"
      aria-label={`Your profile, ${me.name}`}
      className={cn(
        "group block overflow-hidden rounded-xl border border-bone bg-paper transition-all",
        "hover:-translate-y-0.5 hover:border-saffron/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40",
        className
      )}
    >
      {/* Banner strip (avatar overlaps its bottom edge, LinkedIn pattern) */}
      <div className="relative h-14 w-full overflow-hidden bg-navy">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
            style={{ objectPosition: `${fx}% ${fy}%` }}
          />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: preset.background }} />
            {preset.svg ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                dangerouslySetInnerHTML={{ __html: preset.svg }}
              />
            ) : null}
          </>
        )}
      </div>

      {/* Identity block on solid paper -> name contrast is guaranteed */}
      <div className="px-3 pb-3">
        <div className="-mt-6">
          <Avatar
            name={me.name}
            src={me.avatar_url ?? undefined}
            size="md"
            className="ring-2 ring-paper"
          />
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-ink">{me.name}</p>
        {headline ? (
          <p className="truncate text-xs text-ink/70">{headline}</p>
        ) : null}
        {institute ? (
          <p className="truncate text-xs text-ash">{institute}</p>
        ) : (
          <p className="truncate text-xs text-ash">@{me.handle}</p>
        )}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-saffron-dk">
          View profile
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
