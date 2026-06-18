"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!supabaseConfigured) return null;
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}
