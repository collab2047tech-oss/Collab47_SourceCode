"use server";

import { promises as dns } from "node:dns";
import { isValidEmailFormat, isDisposableEmail, emailDomain } from "@/lib/security/email-validate";

/**
 * Validate a signup email WITHOUT sending anything:
 *   1. format (lenient - never rejects a real address)
 *   2. disposable/temp-mail blocklist
 *   3. MX-record check (does the domain actually accept mail?) - FAIL-OPEN:
 *      any DNS error/timeout => allow, so a real user is never blocked by a
 *      network hiccup. Only a domain that definitively has NO mail route
 *      (no MX and no A/AAAA) is rejected.
 */
export async function checkSignupEmail(
  email: string
): Promise<{ ok: boolean; reason?: string }> {
  const e = (email || "").trim().toLowerCase();
  if (!isValidEmailFormat(e)) return { ok: false, reason: "That email does not look valid. Check for typos." };
  if (isDisposableEmail(e)) return { ok: false, reason: "Please use a real, permanent email (no temporary/disposable inboxes)." };

  const domain = emailDomain(e);
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    if (Array.isArray(mx) && mx.length > 0) return { ok: true };
    // No MX: some domains still receive mail on their A record. Check that.
    try {
      const a = await dns.resolve(domain);
      if (Array.isArray(a) && a.length > 0) return { ok: true };
    } catch { /* fall through */ }
    return { ok: false, reason: "That email domain can't receive mail. Check the spelling." };
  } catch {
    // DNS error/timeout -> FAIL OPEN. Never block a real user on a network issue.
    return { ok: true };
  }
}
