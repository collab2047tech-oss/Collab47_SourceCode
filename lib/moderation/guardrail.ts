/**
 * Hard-rule guardrail. Runs before any post hits the DB.
 * Sub-5ms deterministic regex checks. No LLM.
 * Real banned-term lists are kept out of code in a future Postgres table.
 */

export const BANNED_PATTERNS: { name: string; rx: RegExp }[] = [
  // Indian mobile number in body (doxxing)
  { name: "indian_mobile", rx: /\b[6-9]\d{9}\b/ },
  // Aadhaar-like 12-digit pattern
  { name: "aadhaar_like", rx: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  // PAN number pattern
  { name: "pan_like", rx: /\b[A-Z]{5}\d{4}[A-Z]\b/ },
  // Bot/scam: "buy followers"
  { name: "buy_followers", rx: /\b(buy|sell)\s+(followers|likes|subscribers)\b/i },
  // Scam: "click here to win"
  { name: "scam_click", rx: /\bclick\s+(here|now)\s+to\s+(win|claim|earn)/i },
  // Crypto-pump scam
  { name: "crypto_pump", rx: /\b(guaranteed|100%)\s+returns?\b/i },
  // CSAM placeholder (real list maintained out-of-code)
  { name: "csam_placeholder", rx: /^___CSAM_BANNED_PLACEHOLDER___$/ },
];

export interface GuardrailResult {
  ok: boolean;
  reason?: string;
  ruleHit?: string;
}

export function checkContent(text: string): GuardrailResult {
  if (!text) return { ok: true };
  const normalized = text.normalize("NFKC");

  for (const { name, rx } of BANNED_PATTERNS) {
    if (rx.test(normalized)) {
      return { ok: false, reason: friendlyReason(name), ruleHit: name };
    }
  }
  return { ok: true };
}

function friendlyReason(rule: string): string {
  switch (rule) {
    case "indian_mobile":
    case "aadhaar_like":
    case "pan_like":
      return "Looks like a personal identifier. Doxxing is not allowed.";
    case "buy_followers":
    case "scam_click":
    case "crypto_pump":
      return "This reads like a scam or spam.";
    case "csam_placeholder":
      return "Content blocked by policy.";
    default:
      return "Content blocked by policy.";
  }
}

/**
 * Soft toxicity score stub. Real call goes to Cloudflare AI Worker later.
 * Returns 0 to 1. Above 0.7 soft-demote in ranker. Above 0.9 quarantine.
 */
export async function softToxicityScore(_text: string): Promise<number> {
  // TODO: call Cloudflare AI Worker once Day 7+ infra is up.
  return 0;
}
