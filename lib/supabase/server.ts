import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Request-scoped Supabase server client.
 *
 * PERF (the big one): this is wrapped in React `cache()` so the WHOLE app gets a
 * SINGLE client per request render instead of constructing 100+ of them. More
 * importantly, we dedupe `auth.getUser()` - that call hits the Supabase Auth
 * server over the network to validate the JWT, and the app calls it ~10x per
 * page (layout + feed + each data fn). Without deduping, that is 10 serial
 * round-trips to ap-south-1 per navigation (multi-second lag). Here the FIRST
 * getUser() validates once and every later caller in the same request reuses
 * that promise - so it is one round-trip per request, not ten. No call site
 * changes: every existing `sb.auth.getUser()` automatically benefits.
 */
export const getSupabaseServer = cache(async () => {
  if (!supabaseConfigured) return null;
  const cookieStore = await cookies();
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // RSC context cannot set cookies. Middleware handles refresh instead.
        }
      },
    },
  });

  // Per-request dedupe of getUser(). The client is itself cached per request, so
  // this closure variable is shared by every caller in the render: the first
  // no-arg getUser() does the single network validation, the rest reuse it.
  const original = client.auth.getUser.bind(client.auth);
  let pending: ReturnType<typeof original> | null = null;
  client.auth.getUser = ((jwt?: string) => {
    if (jwt) return original(jwt); // explicit-token lookups are not deduped
    if (!pending) pending = original();
    return pending;
  }) as typeof client.auth.getUser;

  return client;
});
