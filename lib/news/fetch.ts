/**
 * Server-only news orchestrator.
 * Fetches from all sources, tags articles, dedupes by URL + title, summarises
 * EVERY storable item, maps internal branch tags to reader-facing topics, and
 * upserts to Supabase. Returns [] when Supabase env is missing.
 */

import { createClient } from "@supabase/supabase-js";
import { NEWS_SOURCES } from "./sources";
import { parseRss, ParsedArticle } from "./parser";
import { tagArticle } from "./tagger";
import { branchToTopics } from "./topics";
import { fetchApiSources } from "./apiSources";
import { summariseArticle, groqConfigured } from "./summarise";
import { rankNews, type NewsViewer } from "./rank";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { NewsItem, NewsSummaryStatus } from "@/lib/supabase/types";

const NEWSAPI_KEY = process.env.NEWS_API_KEY ?? "";

// We now summarise EVERY fresh item that has usable text (or an expandable
// headline) rather than only the newest 60 - the whole point of Phase 4 is that
// every stored card carries a real brief. A high ceiling guards the serverless
// time budget; bounded concurrency keeps us inside Groq's free rate limits.
const SUMMARISE_LIMIT = 400;
const SUMMARISE_CONCURRENCY = 6;

// An item with no image, no body text, and a very short headline is the classic
// "trash" row (GDELT/HN noise). We drop it at the source rather than store an
// empty card.
const MIN_TRASH_TITLE_WORDS = 8;

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

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// Normalised title key for cross-source dedupe: lowercase, strip punctuation,
// keep the first 10 significant words. Collapses the same wire story shipped by
// three different sources into one.
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 10)
    .join(" ");
}

interface Gathered extends ParsedArticle {
  source: string;
}

// Pull every source (RSS + keyed APIs) into one flat list.
async function gatherAll(): Promise<Gathered[]> {
  const out: Gathered[] = [];

  // RSS (+ legacy NewsAPI) from the static source list.
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

// Summarise a list with bounded concurrency.
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
  dropped: number;
  error?: string;
}> {
  const client = getServiceClient();
  if (!client) return { ok: false, inserted: 0, summarised: 0, dropped: 0, error: "no service role" };

  // 1. Gather everything.
  const gathered = await gatherAll();
  if (gathered.length === 0) return { ok: true, inserted: 0, summarised: 0, dropped: 0 };

  // 2. Dedupe by URL (prefer richer content), then by normalised title.
  const byUrl = new Map<string, Gathered>();
  for (const a of gathered) {
    const prev = byUrl.get(a.url);
    if (!prev || (a.content?.length ?? 0) > (prev.content?.length ?? 0)) byUrl.set(a.url, a);
  }
  const byTitle = new Map<string, Gathered>();
  for (const a of byUrl.values()) {
    const key = titleKey(a.title);
    if (!key) {
      byTitle.set(a.url, a); // un-keyable title: keep by url
      continue;
    }
    const prev = byTitle.get(key);
    // Prefer the entry with the richer body / an image when titles collide.
    const better =
      !prev ||
      (a.content?.length ?? 0) > (prev.content?.length ?? 0) ||
      (!prev.image_url && !!a.image_url);
    if (better) byTitle.set(key, a);
  }
  const unique = [...byTitle.values()];

  // 3. Skip URLs already stored (so we only summarise genuinely new articles).
  const urls = unique.map((a) => a.url);
  const existing = new Set<string>();
  for (let s = 0; s < urls.length; s += 200) {
    const slice = urls.slice(s, s + 200);
    const { data } = await client.from("news_items").select("url").in("url", slice);
    for (const r of data ?? []) existing.add(r.url as string);
  }
  let fresh = unique.filter((a) => !existing.has(a.url));
  if (fresh.length === 0) return { ok: true, inserted: 0, summarised: 0, dropped: 0 };

  // 4. Drop the worst "trash" rows BEFORE we spend Groq calls on them: no image
  //    AND no body text AND a very short headline. Nothing to show, nothing to
  //    summarise honestly.
  const beforeDrop = fresh.length;
  fresh = fresh.filter((a) => {
    const hasBody = Boolean((a.content || a.excerpt || "").trim());
    const hasImage = Boolean(a.image_url);
    if (hasBody || hasImage) return true;
    return wordCount(a.title) >= MIN_TRASH_TITLE_WORDS;
  });

  // 5. Summarise everything storable via Groq (newest first, bounded).
  fresh.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  const toSummarise = fresh.slice(0, SUMMARISE_LIMIT);
  const summaries = await summariseBatch(toSummarise);

  // 6. Build rows with an HONEST summary + summary_status. Drop any row that
  //    ends up with no usable summary at all.
  let dropped = beforeDrop - fresh.length;
  const rows: Array<Record<string, unknown>> = [];
  for (const a of fresh) {
    const groq = summaries.get(a.url);
    const rawBody = (a.content || "").trim();
    const rawDesc = (a.excerpt || "").trim();

    let summary: string | null = null;
    let status: NewsSummaryStatus = "none";

    if (groq) {
      summary = groq;
      // Groq ran. If the source had no real body, it expanded the headline.
      status = rawBody.length >= 80 ? "ai" : "headline";
    } else if (rawBody) {
      summary = trimWords(rawBody, 110);
      status = "raw";
    } else if (rawDesc) {
      summary = rawDesc;
      status = "raw";
    }

    // No image AND no usable summary -> genuinely nothing to show. Drop.
    if (!summary && !a.image_url) {
      dropped += 1;
      continue;
    }
    // Image-only with no text we could summarise: still drop, a bare image is
    // not news. (In practice Groq expands the headline, so this is rare.)
    if (!summary) {
      dropped += 1;
      continue;
    }

    const tags = tagArticle(a.title, summary);
    const topics = branchToTopics(tags.branch_tags, a.title, summary);
    rows.push({
      source: a.source,
      url: a.url,
      title: a.title,
      excerpt: rawDesc || null,
      summary,
      summary_status: status,
      topics,
      lang: "en",
      image_url: a.image_url,
      branch_tags: tags.branch_tags,
      city_tags: tags.city_tags,
      published_at: a.published_at,
      fetched_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) return { ok: true, inserted: 0, summarised: summaries.size, dropped };

  // 7. Insert (ignore any racing duplicates).
  const { error, count } = await client
    .from("news_items")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
    .select("id");

  if (error) return { ok: false, inserted: 0, summarised: summaries.size, dropped, error: error.message };
  return { ok: true, inserted: count ?? rows.length, summarised: summaries.size, dropped };
}

/**
 * Recency-ordered recall (used by NewsRail's lightweight branch/city filter and
 * by the ranked path below). Kept for backward compatibility.
 */
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

/**
 * Field-matched news for the signed-in viewer - the real classical engine,
 * extended to news. Loads the viewer's interests/branch/city + durable topic
 * affinity + reading behaviour, recalls the most recent ~300 items, scores them
 * with `rankNews`, diversifies, and returns the top `limit`.
 *
 * Falls back to plain recency when there is no signed-in viewer.
 */
export async function getRankedNewsForUser(limit = 300): Promise<NewsItem[]> {
  const service = getServiceClient();
  if (!service) return [];

  // Recall pool: the most recent ~300 items, scored client-side below.
  const RECALL = Math.max(limit, 300);
  const { data: pool } = await service
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(RECALL);
  const items = (pool as NewsItem[] | null) ?? [];
  if (items.length === 0) return [];

  // Viewer context (auth-aware). No session -> plain recency.
  const sb = await getSupabaseServer();
  if (!sb) return items.slice(0, limit);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return items.slice(0, limit);

  const viewer: NewsViewer = { interests: [], branch: null, city: null };
  const affinity = new Map<string, number>();
  const behaviour = new Map<string, number>();

  const [{ data: prof }, { data: aff }, { data: events }] = await Promise.all([
    sb.from("profiles").select("interests, branch, city").eq("id", user.id).maybeSingle(),
    sb.from("news_topic_affinity").select("topic, weight").eq("user_id", user.id),
    sb
      .from("news_events")
      .select("kind, news_items!inner(topics)")
      .eq("user_id", user.id)
      .in("kind", ["open", "save", "more"])
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  viewer.interests = (prof?.interests as string[]) ?? [];
  viewer.branch = (prof?.branch as string | null) ?? null;
  viewer.city = (prof?.city as string | null) ?? null;

  // Durable affinity -> normalised 0..1 map keyed by lowercase topic.
  let maxAff = 1;
  for (const r of (aff ?? []) as Array<{ topic: string; weight: number }>) {
    maxAff = Math.max(maxAff, r.weight);
  }
  for (const r of (aff ?? []) as Array<{ topic: string; weight: number }>) {
    if (r.weight > 0) affinity.set(r.topic.toLowerCase(), r.weight / maxAff);
  }

  // Reading behaviour -> topic affinity (recency-weighted by event kind).
  const behW: Record<string, number> = { open: 1, more: 2, save: 3 };
  const behCounts = new Map<string, number>();
  for (const e of (events ?? []) as Array<{ kind: string; news_items?: { topics?: string[] } }>) {
    const w = behW[e.kind] ?? 1;
    for (const t of e.news_items?.topics ?? []) {
      const k = t.toLowerCase();
      behCounts.set(k, (behCounts.get(k) ?? 0) + w);
    }
  }
  const maxBeh = Math.max(1, ...behCounts.values());
  for (const [k, c] of behCounts) behaviour.set(k, c / maxBeh);

  return rankNews({ items, viewer, affinity, behaviour, limit });
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  const client = getServiceClient();
  if (!client) return null;
  const { data } = await client.from("news_items").select("*").eq("id", id).maybeSingle();
  return (data as NewsItem) ?? null;
}

/**
 * Keyset pagination for the news reader: the NEXT distinct batch of older items
 * (published_at < `before`), excluding ids already on screen. Lets the reader
 * load EVERY article that exists - no 300-item cap, no re-cycling - until the
 * archive is exhausted. Chronological (newest-first) below the ranked first page.
 */
export async function getOlderNews(
  before: string | null,
  excludeIds: string[],
  limit = 30
): Promise<NewsItem[]> {
  const client = getServiceClient();
  if (!client) return [];
  let q = client
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit + excludeIds.length);
  if (before) q = q.lt("published_at", before);
  const { data } = await q;
  const ex = new Set(excludeIds);
  return ((data as NewsItem[] | null) ?? []).filter((n) => !ex.has(n.id)).slice(0, limit);
}
