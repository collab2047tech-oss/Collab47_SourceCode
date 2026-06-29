"use server";

import { checkSignupEmail } from "@/app/(auth)/email-check";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Authoritative signup gate. This is the ONLY path the app uses to create an
 * email/password account, and it CANNOT be skipped by the browser:
 *
 *   1. checkSignupEmail() runs SERVER-SIDE (format + disposable + MX, fail-open
 *      on DNS) - moving it here closes the bypass where the browser called the
 *      check and then hit supabase.auth.signUp() with the anon key directly,
 *      skipping the check entirely.
 *   2. On pass, signUp() runs through the SSR Supabase client so the session
 *      cookie is set server-side (no confirm-email link is sent - product
 *      decision - so the user is signed in immediately).
 *
 * NOTE: this only stops APP-level bypass. A determined attacker hitting GoTrue
 * /signup directly with the anon key still skips this. Fully closing that needs
 * either confirm-email (rejected by product) or a Supabase 'before-user-created'
 * auth hook that runs the same check at the GoTrue layer.
 */
export async function signUpAction(input: {
  email: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = (input.email || "").trim();
  const password = input.password || "";

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  // Authoritative real-email gate (cannot be skipped by the app).
  const emailCheck = await checkSignupEmail(email);
  if (!emailCheck.ok) {
    return { ok: false, error: emailCheck.reason ?? "Please use a valid email." };
  }

  const sb = await getSupabaseServer();
  if (!sb) {
    return { ok: false, error: "Sign up is not configured yet on this build." };
  }

  // Server-side signUp: the SSR client writes the session cookie via setAll().
  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
