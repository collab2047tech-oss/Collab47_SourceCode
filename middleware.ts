import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const GATED_PREFIXES = ["/home", "/explore", "/network", "/messages", "/profile", "/settings", "/notifications", "/onboarding"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  if (!supabaseConfigured) return res;  // mock-mode dev pass-through

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isGated = GATED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  // Not signed in + on gated route -> redirect to /login
  if (isGated && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Signed in but profile not onboarded -> force /onboarding
  if (user && isGated && path !== "/onboarding") {
    const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", user.id).single();
    if (profile && !profile.onboarded) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  // Signed in user hitting /login or /signup -> redirect home
  if (user && (path === "/login" || path === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
