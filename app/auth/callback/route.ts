import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Account-deletion grace window. Must match the purge cron (14 days). */
const DELETE_GRACE_MS = 14 * 86_400_000;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/home";

  // Open-redirect hardening: only allow same-site absolute paths. Must start with
  // exactly one "/" (reject "//host" and "/\" which browsers treat as off-site),
  // and carry no scheme or backslash. Otherwise fall back to "/home".
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    next.includes("\\") ||
    next.includes("://")
  ) {
    next = "/home";
  }

  if (code) {
    const supabase = await getSupabaseServer();
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code);

      // Restore-on-sign-in: a soft-deleted account that signs back in within the
      // 14-day grace window is reactivated (deleted_at cleared). This is the
      // other half of the "you can restore within 14 days" promise in Settings.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: row } = await supabase
            .from("profiles")
            .select("deleted_at")
            .eq("id", user.id)
            .maybeSingle();
          const deletedAt = (row as { deleted_at: string | null } | null)?.deleted_at;
          if (deletedAt && Date.now() - new Date(deletedAt).getTime() < DELETE_GRACE_MS) {
            await supabase.from("profiles").update({ deleted_at: null }).eq("id", user.id);
            // Signal the welcome-back toast on the landing surface.
            next = next.includes("?") ? `${next}&restored=1` : `${next}?restored=1`;
          }
        }
      } catch {
        /* best-effort: a restore failure must not block sign-in */
      }
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
