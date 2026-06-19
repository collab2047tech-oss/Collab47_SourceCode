import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env";

/**
 * Service-role client. SERVER-ONLY — never import this from a "use client" file.
 * Non-NEXT_PUBLIC env is stripped from client bundles, so the key cannot reach
 * the browser, but privileged writes (managing conversation membership, flipping
 * message-request state, moderation) must still only run server-side.
 *
 * Use this only after verifying the caller's identity/permission with the normal
 * user-scoped client.
 */
export function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
