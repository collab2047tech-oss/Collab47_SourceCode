/**
 * Public directory search. Backs the onboarding institution/startup pickers.
 *
 *   GET /api/directory/search?kind=institution|startup&q=<text>
 *   -> 200 { items: [{ name, city?, state? }] }   (max 12)
 *
 * Ordered by relevance (exact > prefix > word-prefix > substring). An empty `q`
 * returns the first 12 by name (a stable browse list). Public reference data -
 * no auth required. Cached at the edge for an hour.
 *
 * THIS RESPONSE SHAPE IS A CONTRACT consumed by W4-B - do not change it.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchDirectory } from "@/lib/directory/search";
import type { DirectoryKind } from "@/lib/directory/types";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=3600";

export async function GET(req: NextRequest) {
  const kindParam = req.nextUrl.searchParams.get("kind");
  const q = req.nextUrl.searchParams.get("q") ?? "";

  // Lenient on bad input: a picker should never break, just get an empty list.
  if (kindParam !== "institution" && kindParam !== "startup") {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": CACHE } });
  }
  const kind: DirectoryKind = kindParam;

  try {
    const items = await searchDirectory(kind, q, 12);
    return NextResponse.json({ items }, { headers: { "Cache-Control": CACHE } });
  } catch {
    // Fail soft so the onboarding UI keeps working (free-text entry still valid).
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
