// Email sanity checks for signup. Goal: reject obvious fakes + throwaway inboxes
// WITHOUT ever blocking a real user. No confirmation email needed.
// Pure (client-safe) parts here; the MX/DNS check lives in a server action.

/** Lenient, RFC-pragmatic format check. Accepts every realistic real address. */
export function isValidEmailFormat(email: string): boolean {
  const e = (email || "").trim();
  if (e.length < 6 || e.length > 254) return false;
  // one @, non-empty local, domain with a dot and a 2+ char TLD, no spaces.
  return /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e) && !e.includes("..");
}

/** Known disposable / temp-mail domains. Real services - block these. */
export const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com",
  "tempmail.com", "temp-mail.org", "throwawaymail.com", "yopmail.com", "getnada.com",
  "trashmail.com", "fakeinbox.com", "sharklasers.com", "grr.la", "spam4.me",
  "dispostable.com", "maildrop.cc", "mintemail.com", "mailnesia.com", "tempinbox.com",
  "mohmal.com", "emailondeck.com", "mailcatch.com", "spamgourmet.com", "tempr.email",
  "discard.email", "33mail.com", "mytemp.email", "fakemailgenerator.com", "burnermail.io",
  "mailpoof.com", "tempmailo.com", "luxusmail.org", "moakt.com", "inboxkitten.com",
  "1secmail.com", "1secmail.org", "wegwerfemail.de", "tmail.ws", "easytrashmail.com",
]);

export function emailDomain(email: string): string {
  return (email.split("@")[1] || "").trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  return DISPOSABLE_DOMAINS.has(emailDomain(email));
}
