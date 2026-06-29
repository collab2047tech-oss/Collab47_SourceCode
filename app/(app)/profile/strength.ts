import type { Profile } from "@/lib/supabase/types";

/**
 * Profile strength - a real, weighted completeness metric shown ONLY to the
 * owner on /profile. Every signal is derived from real profile/content data;
 * nothing is faked. Each unmet item carries a deep link so the meter doubles as
 * an actionable "complete your profile" checklist (LinkedIn-style).
 */
export interface StrengthItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  weight: number;
}

export interface StrengthResult {
  score: number;
  items: StrengthItem[];
  /** Items still to do, sorted by weight (highest impact first). */
  todo: StrengthItem[];
}

export function computeStrength(
  p: Profile,
  counts: { posts: number; projects: number; connections: number }
): StrengthResult {
  const hasBanner = Boolean(p.banner_preset) || Boolean(p.cover_url);
  const links = p.links ?? {};
  const hasLink = Object.values(links).some(
    (v) => typeof v === "string" && v.trim() !== ""
  );

  const items: StrengthItem[] = [
    { key: "avatar", label: "Add a profile photo", done: Boolean(p.avatar_url), href: "/profile/edit", weight: 3 },
    { key: "banner", label: "Set a banner", done: hasBanner, href: "/profile/edit", weight: 2 },
    { key: "bio", label: "Write a bio (40+ characters)", done: (p.bio?.trim().length ?? 0) >= 40, href: "/profile/edit", weight: 3 },
    { key: "college", label: "Add your college", done: Boolean(p.college), href: "/profile/edit", weight: 2 },
    { key: "branch", label: "Add your branch", done: Boolean(p.branch), href: "/profile/edit", weight: 1 },
    { key: "year", label: "Add your year of study", done: Boolean(p.year_of_study), href: "/profile/edit", weight: 1 },
    { key: "city", label: "Add your city", done: Boolean(p.city), href: "/profile/edit", weight: 1 },
    { key: "link", label: "Add at least one link", done: hasLink, href: "/profile/edit", weight: 2 },
    { key: "posts", label: "Publish 3 posts", done: counts.posts >= 3, href: "/home", weight: 3 },
    { key: "project", label: "Start or join a project", done: counts.projects >= 1, href: "/collabs/new", weight: 2 },
    { key: "connections", label: "Make 5 connections", done: counts.connections >= 5, href: "/network", weight: 2 },
  ];

  const total = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const score = total === 0 ? 0 : Math.round((earned / total) * 100);
  const todo = items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight);

  return { score, items, todo };
}
