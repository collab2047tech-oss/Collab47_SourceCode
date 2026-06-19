/**
 * Keyed news API adapters. Each returns ParsedArticle[] (with `content` for the
 * summariser where the API provides it). Server-only. An adapter with no key or
 * a failed request simply returns [] — one bad source never kills the run.
 */

import type { ParsedArticle } from "./parser";

const KEYS = {
  newsdata: process.env.NEWSDATA_API_KEY ?? "",
  guardian: process.env.GUARDIAN_API_KEY ?? "",
  gnews: process.env.GNEWS_API_KEY ?? "",
  nyt: process.env.NYT_API_KEY ?? "",
  thenewsapi: process.env.THENEWSAPI_KEY ?? "",
  currents: process.env.CURRENTS_API_KEY ?? "",
  mediastack: process.env.MEDIASTACK_API_KEY ?? "",
};

function iso(d: string | number | undefined): string {
  if (!d) return new Date().toISOString();
  const t = new Date(d);
  return isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Collab47-NewsBot/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface ApiSourceResult {
  source: string;
  articles: ParsedArticle[];
}

// ---- NewsData.io -----------------------------------------------------------
async function newsdata(): Promise<ApiSourceResult> {
  if (!KEYS.newsdata) return { source: "NewsData", articles: [] };
  const url = `https://newsdata.io/api/1/latest?apikey=${KEYS.newsdata}&country=in&language=en`;
  const json = (await getJson(url)) as { results?: Array<Record<string, unknown>> } | null;
  const articles: ParsedArticle[] = (json?.results ?? [])
    .filter((r) => r.title && r.link)
    .map((r) => ({
      title: String(r.title),
      url: String(r.link),
      excerpt: String(r.description ?? "").slice(0, 400),
      content: typeof r.content === "string" && r.content !== "ONLY AVAILABLE IN PAID PLANS"
        ? r.content : String(r.description ?? ""),
      image_url: (r.image_url as string) ?? null,
      published_at: iso(r.pubDate as string),
    }));
  return { source: "NewsData", articles };
}

// ---- The Guardian (full bodyText) -----------------------------------------
async function guardian(): Promise<ApiSourceResult> {
  if (!KEYS.guardian) return { source: "The Guardian", articles: [] };
  const url = `https://content.guardianapis.com/search?api-key=${KEYS.guardian}&page-size=30&order-by=newest&show-fields=trailText,thumbnail,bodyText`;
  const json = (await getJson(url)) as {
    response?: { results?: Array<Record<string, unknown>> };
  } | null;
  const articles: ParsedArticle[] = (json?.response?.results ?? [])
    .filter((r) => r.webTitle && r.webUrl)
    .map((r) => {
      const f = (r.fields as Record<string, string>) ?? {};
      return {
        title: String(r.webTitle),
        url: String(r.webUrl),
        excerpt: (f.trailText ?? "").replace(/<[^>]+>/g, "").slice(0, 400),
        content: f.bodyText ?? f.trailText ?? "",
        image_url: f.thumbnail ?? null,
        published_at: iso(r.webPublicationDate as string),
      };
    });
  return { source: "The Guardian", articles };
}

// ---- GNews -----------------------------------------------------------------
async function gnews(): Promise<ApiSourceResult> {
  if (!KEYS.gnews) return { source: "GNews", articles: [] };
  const url = `https://gnews.io/api/v4/top-headlines?apikey=${KEYS.gnews}&country=in&lang=en&max=10`;
  const json = (await getJson(url)) as { articles?: Array<Record<string, unknown>> } | null;
  const articles: ParsedArticle[] = (json?.articles ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: String(a.title),
      url: String(a.url),
      excerpt: String(a.description ?? "").slice(0, 400),
      content: String(a.content ?? a.description ?? ""),
      image_url: (a.image as string) ?? null,
      published_at: iso(a.publishedAt as string),
    }));
  return { source: "GNews", articles };
}

// ---- New York Times (Top Stories) -----------------------------------------
async function nyt(): Promise<ApiSourceResult> {
  if (!KEYS.nyt) return { source: "New York Times", articles: [] };
  const url = `https://api.nytimes.com/svc/topstories/v2/home.json?api-key=${KEYS.nyt}`;
  const json = (await getJson(url)) as { results?: Array<Record<string, unknown>> } | null;
  const articles: ParsedArticle[] = (json?.results ?? [])
    .filter((r) => r.title && r.url)
    .map((r) => {
      const media = (r.multimedia as Array<{ url?: string }>) ?? [];
      return {
        title: String(r.title),
        url: String(r.url),
        excerpt: String(r.abstract ?? "").slice(0, 400),
        content: String(r.abstract ?? ""),
        image_url: media[0]?.url ?? null,
        published_at: iso(r.published_date as string),
      };
    });
  return { source: "New York Times", articles };
}

// ---- TheNewsAPI ------------------------------------------------------------
async function thenewsapi(): Promise<ApiSourceResult> {
  if (!KEYS.thenewsapi) return { source: "TheNewsAPI", articles: [] };
  const url = `https://api.thenewsapi.com/v1/news/top?api_token=${KEYS.thenewsapi}&locale=in&language=en&limit=10`;
  const json = (await getJson(url)) as { data?: Array<Record<string, unknown>> } | null;
  const articles: ParsedArticle[] = (json?.data ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: String(a.title),
      url: String(a.url),
      excerpt: String(a.snippet ?? a.description ?? "").slice(0, 400),
      content: String(a.description ?? a.snippet ?? ""),
      image_url: (a.image_url as string) ?? null,
      published_at: iso(a.published_at as string),
    }));
  return { source: "TheNewsAPI", articles };
}

// ---- Currents --------------------------------------------------------------
async function currents(): Promise<ApiSourceResult> {
  if (!KEYS.currents) return { source: "Currents", articles: [] };
  const url = `https://api.currentsapi.services/v1/latest-news?apiKey=${KEYS.currents}&language=en`;
  const json = (await getJson(url)) as { news?: Array<Record<string, unknown>> } | null;
  const articles: ParsedArticle[] = (json?.news ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: String(a.title),
      url: String(a.url),
      excerpt: String(a.description ?? "").slice(0, 400),
      content: String(a.description ?? ""),
      image_url: (a.image as string) && a.image !== "None" ? String(a.image) : null,
      published_at: iso(a.published as string),
    }));
  return { source: "Currents", articles };
}

// ---- Mediastack ------------------------------------------------------------
async function mediastack(): Promise<ApiSourceResult> {
  if (!KEYS.mediastack) return { source: "Mediastack", articles: [] };
  const url = `https://api.mediastack.com/v1/news?access_key=${KEYS.mediastack}&countries=in&languages=en&limit=25&sort=published_desc`;
  const json = (await getJson(url)) as { data?: Array<Record<string, unknown>> } | null;
  const articles: ParsedArticle[] = (json?.data ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: String(a.title),
      url: String(a.url),
      excerpt: String(a.description ?? "").slice(0, 400),
      content: String(a.description ?? ""),
      image_url: (a.image as string) ?? null,
      published_at: iso(a.published_at as string),
    }));
  return { source: "Mediastack", articles };
}

export async function fetchApiSources(): Promise<ApiSourceResult[]> {
  return Promise.all([
    newsdata(),
    guardian(),
    gnews(),
    nyt(),
    thenewsapi(),
    currents(),
    mediastack(),
  ]);
}
