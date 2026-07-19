/**
 * Directory search (server-only). Backs GET /api/directory/search.
 *
 * Strategy: pull a candidate pool with a trigram-indexed ILIKE substring match,
 * then rank in JS so the most picker-relevant hits come first:
 *   exact > starts-with > word-boundary starts-with > substring (earlier = better)
 * Empty query -> first N by name (a stable "browse" list). Read-only; uses the
 * service client purely to bypass PostgREST anon quirks - the data is public.
 */
import { getAdminClient } from "@/lib/supabase/admin";
import { collapseWhitespace } from "./normalize";
import type { DirectoryKind, DirectorySearchItem } from "./types";

const POOL = 80;

interface Row {
  name: string;
  city: string | null;
  state: string | null;
}

function toItem(r: Row): DirectorySearchItem {
  const item: DirectorySearchItem = { name: r.name };
  if (r.city) item.city = r.city;
  if (r.state) item.state = r.state;
  return item;
}

/** Escape LIKE metacharacters so a user's "%"/"_" is treated literally. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

function score(name: string, q: string): number {
  const n = name.toLowerCase();
  if (n === q) return 1000;
  if (n.startsWith(q)) return 800 - Math.min(name.length, 120) * 0.1;
  const words = n.split(/[\s,()/\-.]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 600;
  const idx = n.indexOf(q);
  if (idx >= 0) return 400 - idx;
  return 0;
}

export async function searchDirectory(
  kind: DirectoryKind,
  rawQ: string,
  limit = 12
): Promise<DirectorySearchItem[]> {
  const client = getAdminClient();
  if (!client) return [];

  const q = collapseWhitespace(rawQ).toLowerCase();

  if (!q) {
    const { data } = await client
      .from("directory_entries")
      .select("name, city, state")
      .eq("kind", kind)
      .order("name", { ascending: true })
      .limit(limit);
    return (data ?? []).map((r) => toItem(r as Row));
  }

  const pattern = `%${escapeLike(q)}%`;
  const { data } = await client
    .from("directory_entries")
    .select("name, city, state")
    .eq("kind", kind)
    .ilike("name", pattern)
    .limit(POOL);

  const rows = (data ?? []) as Row[];
  return rows
    .map((r) => ({ r, s: score(r.name, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.r.name.length - b.r.name.length || a.r.name.localeCompare(b.r.name))
    .slice(0, limit)
    .map((x) => toItem(x.r));
}
