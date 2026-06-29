import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Constant-time equality for two secrets. Uses crypto.timingSafeEqual to avoid a
 * timing side-channel on the `===` short-circuit. timingSafeEqual THROWS on a
 * length mismatch, so we guard with an equal-length check first (a length leak
 * is acceptable; per-byte content timing is what we protect).
 */
function safeEqual(incoming: string | null | undefined, secret: string): boolean {
  const a = Buffer.from(incoming ?? "");
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Authenticate a cron request against CRON_SECRET in constant time. Accepts our
 * own `x-cron-secret` header (GitHub Action) or Vercel's built-in cron bearer
 * token (`Authorization: Bearer <secret>`).
 */
export function cronAuthorized(req: NextRequest, secret: string): boolean {
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return safeEqual(headerSecret, secret) || safeEqual(bearer, secret);
}
