/**
 * Honest auth-provider feature flags.
 *
 * Google OAuth and phone/SMS OTP only work if the matching provider is also
 * enabled inside the Supabase dashboard. There is no client-side API to detect
 * that, so we gate the UI on explicit public env flags. When a flag is unset
 * (the default), the corresponding button renders as a disabled "Coming soon"
 * control instead of a live button that would throw a raw Supabase error like
 * "Unsupported provider" / "phone signups are disabled" — i.e. no dead buttons.
 *
 * To turn a method on, set the flag to "true" in the environment AND enable the
 * provider in Supabase:
 *   NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
 *   NEXT_PUBLIC_PHONE_AUTH_ENABLED=true
 *
 * These are read at build time (NEXT_PUBLIC_*), so they must be literal reads.
 */

export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export const PHONE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";
