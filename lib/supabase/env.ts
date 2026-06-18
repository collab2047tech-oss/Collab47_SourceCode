/**
 * Single source of truth for whether Supabase is configured.
 * App degrades to mock-data mode when missing, so dev keeps running.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
