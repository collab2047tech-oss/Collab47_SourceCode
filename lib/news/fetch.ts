/**
 * Server-only news orchestrator.
 * Fetches from all sources, tags articles, dedupes by URL, upserts to Supabase.
 * Falls back to mock data when Supabase env is missing.
 */

import { createClient } from "@supabase/supabase-js";
import { NEWS_SOURCES } from "./sources";
import { parseRss, parseGdelt, ParsedArticle } from "./parser";
import { tagArticle } from "./tagger";
import { fetchApiSources } from "./apiSources";
import { summariseArticle, groqConfigured } from "./summarise";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";
import type { NewsItem } from "@/lib/supabase/types";

const NEWSAPI_KEY = process.env.NEWS_API_KEY ?? "";

// Max articles to run through the Groq summariser per run (keeps us inside the
// serverless time budget + Groq free rate limits). The rest keep their raw
// description as the summary.
const SUMMARISE_LIMIT = 60;
const SUMMARISE_CONCURRENCY = 6;

function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Trim text to roughly n words (used as a rich fallback summary).
function trimWords(s: string, n: number): string {
  const words = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ");
  if (words.length <= n) return words.join(" ");
  return words.slice(0, n).join(" ") + "…";
}

interface Gathered extends ParsedArticle {
  source: string;
}

// Pull every source (RSS + GDELT + keyed APIs) into one flat list.
async function gatherAll(): Promise<Gathered[]> {
  const out: Gathered[] = [];

  // RSS + GDELT (+ legacy NewsAPI) from the static source list.
  await Promise.all(
    NEWS_SOURCES.map(async (source) => {
      try {
        if (source.type === "newsapi" && !NEWSAPI_KEY) return;
        const fetchUrl =
          source.type === "newsapi" ? `${source.url}&apiKey=${NEWSAPI_KEY}` : source.url;
        const res = await fetch(fetchUrl, {
          headers: { "User-Agent": "Collab47-NewsBot/1.0" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return;

        let articles: ParsedArticle[] = [];
        if (source.type === "rss") {
          articles = parseRss(await res.text());
        } else if (source.type === "gdelt") {
          articles = parseGdelt(await res.json());
        } else if (source.type === "newsapi") {
          const json = (await res.json()) as {
            articles?: Array<{ title?: string; url?: string; description?: string; urlToImage?: string; publishedAt?: string }>;
          };
          articles = (json.articles ?? [])
            .filter((a) => a.title && a.url)
            .map((a) => ({
              title: a.title as string,
              url: a.url as string,
              excerpt: (a.description ?? "").slice(0, 400),
              content: a.description ?? "",
              image_url: a.urlToImage ?? null,
              published_at: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(),
            }));
        }
        for (const a of articles) out.push({ ...a, source: source.name });
      } catch {
        /* one bad source never kills the run */
      }
    })
  );

  // Keyed JSON APIs (NewsData, Guardian, GNews, NYT, TheNewsAPI, Currents, Mediastack).
  const apiResults = await fetchApiSources();
  for (const r of apiResults) {
    for (const a of r.articles) out.push({ ...a, source: r.source });
  }

  return out;
}

// Summarise a list with bounded concurrency. Falls back to raw excerpt on miss.
async function summariseBatch(items: Gathered[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!groqConfigured()) return result;

  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const a = items[idx];
      const summary = await summariseArticle({
        title: a.title,
        text: a.content || a.excerpt || a.title,
      });
      if (summary) result.set(a.url, summary);
    }
  }
  await Promise.all(Array.from({ length: SUMMARISE_CONCURRENCY }, worker));
  return result;
}

export async function fetchAndStoreNews(): Promise<{
  ok: boolean;
  inserted: number;
  summarised: number;
  error?: string;
}> {
  const client = getServiceClient();
  if (!client) return { ok: false, inserted: 0, summarised: 0, error: "no service role" };

  // 1. Gather everything.
  const gathered = await gatherAll();
  if (gathered.length === 0) return { ok: true, inserted: 0, summarised: 0 };

  // 2. Dedupe by URL (in-memory), prefer entries that carry richer content.
  const byUrl = new Map<string, Gathered>();
  for (const a of gathered) {
    const prev = byUrl.get(a.url);
    if (!prev || (a.content?.length ?? 0) > (prev.content?.length ?? 0)) byUrl.set(a.url, a);
  }
  const unique = [...byUrl.values()];

  // 3. Skip URLs already stored (so we only summarise genuinely new articles).
  const urls = unique.map((a) => a.url);
  const existing = new Set<string>();
  for (let s = 0; s < urls.length; s += 200) {
    const slice = urls.slice(s, s + 200);
    const { data } = await client.from("news_items").select("url").in("url", slice);
    for (const r of data ?? []) existing.add(r.url as string);
  }
  const fresh = unique.filter((a) => !existing.has(a.url));
  if (fresh.length === 0) return { ok: true, inserted: 0, summarised: 0 };

  // 4. Summarise the newest N fresh articles via Groq (rest keep raw excerpt).
  fresh.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  const toSummarise = fresh.slice(0, SUMMARISE_LIMIT);
  const summaries = await summariseBatch(toSummarise);

  // 5. Build rows. Summary priority:
  //    Groq summary  >  trimmed full content (~160 words)  >  raw description.
  const rows = fresh.map((a) => {
    const fromContent = a.content ? trimWords(a.content, 160) : "";
    const summary = summaries.get(a.url) || fromContent || a.excerpt || null;
    const tags = tagArticle(a.title, summary ?? "");
    return {
      source: a.source,
      url: a.url,
      title: a.title,
      excerpt: summary,
      image_url: a.image_url,
      branch_tags: tags.branch_tags,
      city_tags: tags.city_tags,
      published_at: a.published_at,
      fetched_at: new Date().toISOString(),
    };
  });

  // 6. Insert (ignore any racing duplicates).
  const { error, count } = await client
    .from("news_items")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
    .select("id");

  if (error) return { ok: false, inserted: 0, summarised: summaries.size, error: error.message };
  return { ok: true, inserted: count ?? rows.length, summarised: summaries.size };
}

export async function getNewsForUser(
  branch?: string,
  city?: string,
  limit = 10
): Promise<NewsItem[]> {
  const client = getServiceClient();
  if (!client) return [];

  let query = client
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (branch) {
    query = query.contains("branch_tags", [branch]);
  }
  if (city) {
    query = query.contains("city_tags", [city]);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data as NewsItem[];
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  const client = getServiceClient();
  if (!client) return null;
  const { data } = await client.from("news_items").select("*").eq("id", id).maybeSingle();
  return (data as NewsItem) ?? null;
}
