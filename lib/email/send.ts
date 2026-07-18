const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Fire-and-forget transactional email via Resend. This NEVER throws: a failed
 * email must not break the user action that triggered it (same contract as
 * createNotification). It also no-ops silently when RESEND_API_KEY is unset or
 * the sending domain is not yet verified, so wiring it up early is harmless.
 */
export async function sendEmail(input: EmailInput): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.EMAIL_FROM || "Collab47 <hello@collab47.com>";
  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
  if (to.length === 0) return;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[email] send error", e);
  }
}

/** Minimal HTML escape for user-supplied content dropped into email bodies. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
