/**
 * Live username availability for onboarding. GET /api/handle-available?handle=xyz
 *
 * Lets the identity step tell someone their username is taken WHILE they are
 * typing it, instead of after they finish the whole flow. Uses the service client
 * so it can see every profile regardless of RLS.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isReserved } from "@/lib/data/reserved-handles";

export const dynamic = "force-dynamic";

export type HandleStatus = "ok" | "format" | "reserved" | "taken" | "similar" | "unknown";

export async function GET(req: NextRequest) {
  const handle = (req.nextUrl.searchParams.get("handle") ?? "").toLowerCase().trim();

  if (!/^[a-z0-9_]{3,32}$/.test(handle)) {
    return NextResponse.json({ available: false, status: "format" as HandleStatus });
  }
  if (isReserved(handle)) {
    return NextResponse.json({ available: false, status: "reserved" as HandleStatus });
  }

  const admin = getAdminClient();
  if (!admin) {
    // Fail open: the server action still enforces uniqueness authoritatively.
    return NextResponse.json({ available: true, status: "unknown" as HandleStatus });
  }

  const { data } = await admin.from("profiles").select("id").eq("handle", handle).maybeSingle();
  if (data) {
    return NextResponse.json({ available: false, status: "taken" as HandleStatus });
  }

  // Confusable-username check: is the canonical (underscore-stripped) form
  // already taken? "shorya_noodle" collides with "shoryanoodle". The DB function
  // is the single source of truth (also enforced by the unique index + the
  // server action); we call it here so the user hears it while still typing.
  const { data: canonicalTaken } = await admin.rpc("handle_canonical_taken", { candidate: handle });
  if (canonicalTaken) {
    return NextResponse.json({ available: false, status: "similar" as HandleStatus });
  }

  return NextResponse.json({ available: true, status: "ok" as HandleStatus });
}
