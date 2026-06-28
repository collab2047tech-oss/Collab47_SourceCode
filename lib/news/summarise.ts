/**
 * Groq-backed news summariser. Turns raw article text into a tight
 * 5-8 line, ~70-word neutral summary (InShorts style). Server-only.
 *
 * Free, fast (Llama 3.3 70B on Groq). Called only for NEW articles in the
 * hourly/daily fetch job, never in the live feed path.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// 8b-instant: much higher free token-per-minute limit + far faster, so many
// more articles get a real summary per fetch run.
const MODEL = "llama-3.1-8b-instant";

export function groqConfigured(): boolean {
  return Boolean(GROQ_API_KEY);
}

const SYSTEM = [
  "You are a news editor for Indian college students.",
  "Rewrite the article into a clear, neutral brief of about 90 to 110 words (roughly 5 to 7 lines).",
  "Cover the key facts: what happened, who is involved, where, and why it matters.",
  "Plain factual sentences in short paragraphs. No opinion, no hype, no emojis, no markdown, no hashtags, no bullet points.",
  "Do not start with 'This article' or 'The article'. Start with the news itself.",
  "If the input is too thin, expand sensibly from the headline into 3 to 4 factual sentences, but never invent specific numbers, dates, or quotes that are not in the headline.",
].join(" ");

/**
 * Returns a clean summary, or null on failure (caller falls back to raw text).
 */
export async function summariseArticle(input: {
  title: string;
  text: string;
}): Promise<string | null> {
  if (!GROQ_API_KEY) return null;

  const source = (input.text || "").replace(/\s+/g, " ").trim().slice(0, 4000);
  const user = `Headline: ${input.title}\n\nArticle:\n${source || input.title}`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 420,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const out = json.choices?.[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
