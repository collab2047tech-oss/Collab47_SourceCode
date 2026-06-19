/**
 * moderateContent — two-layer content moderation. Server-only.
 *
 * Layer 1: Synchronous regex hard-rules (guardrail.ts). Fast, deterministic.
 * Layer 2: Groq Llama-Guard-3-8B AI toxicity check. Best-effort — any
 *           failure (no key, network error, 429, timeout) silently passes.
 *
 * Endpoint: POST https://api.groq.com/openai/v1/chat/completions
 * Model:    llama-guard-3-8b
 */

import { checkContent } from "./guardrail";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const LLAMA_GUARD_MODEL = "llama-guard-3-8b";

export async function moderateContent(
  text: string
): Promise<{ ok: boolean; reason?: string }> {
  // ── Layer 1: hard regex rules ────────────────────────────────────────────
  const ruleResult = checkContent(text);
  if (!ruleResult.ok) {
    return { ok: false, reason: ruleResult.reason };
  }

  // ── Layer 2: Groq Llama-Guard (best-effort) ──────────────────────────────
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // No key configured — skip AI layer, rules already passed.
    return { ok: true };
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLAMA_GUARD_MODEL,
        messages: [{ role: "user", content: text }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    // Graceful degradation on rate-limit or server error — never block the user.
    if (!res.ok) {
      return { ok: true };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const verdict = json.choices?.[0]?.message?.content?.trim().toLowerCase() ?? "";

    // Llama-Guard returns "safe" or "unsafe\n<S1,S2,...>" (violation codes).
    if (verdict.startsWith("unsafe")) {
      return { ok: false, reason: "This violates our community guidelines." };
    }

    return { ok: true };
  } catch {
    // Network error, AbortError (timeout), JSON parse failure — pass through.
    return { ok: true };
  }
}
