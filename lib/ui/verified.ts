// Plain (server-safe) helpers for verified contributions. Kept OUT of the
// client `ProfileTabs` component so server pages (/profile, /u/[handle]) can
// call `normalizeVerified` without crossing the client boundary.

/** A verified contribution row (shape from getVerifiedProjectsForUser). */
export interface VerifiedContribution {
  role: string;
  project: {
    id: string;
    short_id: string;
    title: string;
    deliverable_url: string | null;
    delivered_at: string | null;
    author: { handle: string; name: string } | null;
  };
}

/**
 * Normalize the raw `getVerifiedProjectsForUser` rows into VerifiedContribution.
 * Supabase's join inference can type `project`/`author` as arrays, so we coerce
 * the first element when needed. Returns only rows with a resolvable project.
 */
export function normalizeVerified(rows: unknown[]): VerifiedContribution[] {
  const first = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  const out: VerifiedContribution[] = [];
  for (const raw of rows ?? []) {
    const r = raw as { role?: string; project?: unknown };
    const proj = first(r.project) as
      | { id: string; short_id: string; title: string; deliverable_url: string | null; delivered_at: string | null; author?: unknown }
      | null;
    if (!proj) continue;
    const author = first(proj.author) as { handle: string; name: string } | null;
    out.push({
      role: r.role ?? "",
      project: {
        id: proj.id,
        short_id: proj.short_id,
        title: proj.title,
        deliverable_url: proj.deliverable_url ?? null,
        delivered_at: proj.delivered_at ?? null,
        author: author ? { handle: author.handle, name: author.name } : null,
      },
    });
  }
  return out;
}
