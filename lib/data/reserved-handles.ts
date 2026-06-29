// ---------------------------------------------------------------------------
// Reserved handles
// ---------------------------------------------------------------------------
// Usernames that must never be claimable by a user. They map to routes,
// system/brand identities, or words that would enable impersonation
// (e.g. "admin", "official", "collab47"). All entries are lowercase; the
// `isReserved` helper lowercases its input before checking so the comparison
// is case-insensitive.

export const RESERVED_HANDLES: Set<string> = new Set([
  "admin",
  "administrator",
  "support",
  "official",
  "collab47",
  "collab",
  "help",
  "mod",
  "moderator",
  "system",
  "security",
  "root",
  "api",
  "www",
  "mail",
  "settings",
  "login",
  "signup",
  "signin",
  "logout",
  "about",
  "privacy",
  "terms",
  "home",
  "explore",
  "news",
  "network",
  "messages",
  "notifications",
  "profile",
  "analytics",
  "events",
  "collabs",
  "queue",
  "auth",
  "null",
  "undefined",
  "me",
  "you",
]);

/** True when `handle` (case-insensitively) is a reserved username. */
export function isReserved(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}
