/**
 * Hard-rule guardrail. Runs before any post hits the DB.
 * Sub-5ms deterministic regex checks. No LLM.
 * Real banned-term lists are kept out of code in a future Postgres table.
 */

export const BANNED_PATTERNS: { name: string; rx: RegExp }[] = [
  // ── Doxxing ──────────────────────────────────────────────────────────────
  // Indian mobile number (10 digits starting 6-9, word-bounded to avoid matching inside larger numbers)
  { name: "indian_mobile", rx: /(?<!\d)[6-9]\d{9}(?!\d)/ },
  // Aadhaar-like 12-digit pattern (space or hyphen separated groups: 4-4-4)
  { name: "aadhaar_like", rx: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/ },
  // PAN number pattern (AAAAA9999A)
  { name: "pan_like", rx: /\b[A-Z]{5}\d{4}[A-Z]\b/ },
  // IFSC code (bank account doxxing aid)
  { name: "ifsc_like", rx: /\b[A-Z]{4}0[A-Z0-9]{6}\b/ },
  // UPI ID pattern (something@upi/paytm/gpay etc.)
  { name: "upi_id", rx: /\b[\w.\-+]+@(upi|paytm|gpay|phonepe|ybl|okaxis|okhdfcbank|okicici|oksbi|ibl|axl|waicici|wahdfcbank)\b/i },

  // ── Hate speech / slurs ──────────────────────────────────────────────────
  // Common English slurs (word-boundary matched to avoid false positives on substrings)
  { name: "slur_n_word", rx: /\bn[i1!][g9][g9][ae3]r[s]?\b/i },
  { name: "slur_n_word2", rx: /\bn[i1!][g9]{2}[ae3]?\b/i },
  { name: "slur_f_word_hate", rx: /\bf[a@]g{1,2}[o0]t[s]?\b/i },
  { name: "slur_k_word", rx: /\bk[i1]k[e3][s]?\b/i },
  { name: "slur_chink", rx: /\bch[i1]nk[s]?\b/i },
  { name: "slur_sp_word", rx: /\bsp[i1]c[s]?\b/i },
  { name: "slur_w_word", rx: /\bw[e3]tb[a@]ck[s]?\b/i },
  // Common Indian communal slurs
  { name: "slur_katua", rx: /\bk[a@]tu[a@][s]?\b/i },
  { name: "slur_chamaar", rx: /\bch[a@]m[a@][a@]r[s]?\b/i },
  { name: "slur_bhangi", rx: /\bbh[a@]ng[i1][s]?\b/i },
  { name: "slur_mleccha_hate", rx: /\bml[e3]cch[a@]\b/i },
  // Caste-based attack phrases
  { name: "caste_attack", rx: /\b(kill|hang|rape|burn)\s+(all\s+)?(dalits?|brahmin[s]?|upper[\s\-]caste|lower[\s\-]caste)\b/i },

  // ── CSAM / grooming ──────────────────────────────────────────────────────
  { name: "csam_explicit", rx: /\b(child\s+porn(?:ography)?|cp\s+link|loli\s+porn|shota\s+porn|jailbait)\b/i },
  { name: "grooming_1", rx: /\b(send\s+me\s+your\s+(nudes?|pics?|photos?)).{0,30}(minor|kid|child|teen|underage|year[\s\-]old)\b/i },
  { name: "grooming_2", rx: /\b(nude[s]?|naked\s+pic[s]?)\s+(of\s+)?(minor|kid|child|teen|underage)\b/i },
  { name: "grooming_3", rx: /\b(meet[\s\-]up|meetup|meet\s+irl).{0,50}(minor|kid|child|underage|year[\s\-]old)\b/i },

  // ── Scam / spam ──────────────────────────────────────────────────────────
  // Bot/scam: "buy/sell followers/likes/subscribers"
  { name: "buy_followers", rx: /\b(buy|sell|get)\s+(real\s+)?(followers|likes|subscribers|views|comments)\b/i },
  // Scam: "click here to win/claim/earn"
  { name: "scam_click", rx: /\bclick\s+(here|now|this\s+link)\s+to\s+(win|claim|earn|get\s+paid|receive)\b/i },
  // Crypto-pump scam
  { name: "crypto_pump", rx: /\b(guaranteed|100%)\s+(daily\s+)?returns?\b/i },
  // Investment scam
  { name: "investment_scam", rx: /\b(double|triple|10x|100x)\s+your\s+(money|investment|crypto|bitcoin)\b/i },
  // Lottery / prize scam
  { name: "lottery_scam", rx: /\b(you\s+have\s+(won|been\s+selected)|congratulations.{0,30}(winner|prize|lottery))\b/i },
  // WhatsApp / Telegram spam recruitment
  { name: "wa_spam", rx: /\bjoin\s+(our|my|this)\s+(whatsapp|telegram|signal)\s+(group|channel).{0,40}(earn|money|income|profit|paid)\b/i },
  // Work-from-home fraud
  { name: "wfh_scam", rx: /\b(work\s+from\s+home|part[\s\-]time\s+job).{0,50}(earn|rs\.?\s*\d{4,}|₹\s*\d{4,}|daily\s+income)\b/i },
  // OTP phishing
  { name: "otp_phish", rx: /\b(share|send|give|tell)\s+(me\s+)?(your\s+)?otp\b/i },
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
