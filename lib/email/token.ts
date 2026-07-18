import { createHmac, timingSafeEqual } from "crypto";

// Stateless unsubscribe token: an HMAC of the user id keyed on CRON_SECRET, so a
// digest can carry a one-click opt-out link without a session or a stored token.
export function unsubToken(userId: string): string {
  const secret = process.env.CRON_SECRET || "";
  return createHmac("sha256", secret).update(`unsub:${userId}`).digest("hex").slice(0, 32);
}

export function verifyUnsub(userId: string, token: string): boolean {
  if (!token) return false;
  const expected = unsubToken(userId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
