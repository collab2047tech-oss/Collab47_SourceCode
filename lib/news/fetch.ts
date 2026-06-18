/**
 * Server-only news orchestrator.
 * Fetches from all sources, tags articles, dedupes by URL, upserts to Supabase.
 * Falls back to mock data when Supabase env is missing.
 */

import { createClient } from "@supabase/supabase-js";
import { NEWS_SOURCES } from "./sources";
import { parseRss, parseGdelt, ParsedArticle } from "./parser";
import { tagArticle } from "./tagger";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";
import type { NewsItem } from "@/lib/supabase/types";

const NEWSAPI_KEY = process.env.NEWS_API_KEY ?? "";

/** Mock fallback items used when Supabase is not configured. */
const MOCK_NEWS: NewsItem[] = [
  {
    id: "mock-1",
    source: "Indian Express",
    url: "https://indianexpress.com/article/jobs/tcs-infosys-campus-hiring-2026",
    title: "TCS and Infosys ramp campus hiring for 2026 batch: what CSE students need to know",
    excerpt:
      "Both IT majors have announced a combined 80,000 fresher offers for the 2026 engineering batch, with on-site reporting dates moved to October.",
    image_url: null,
    branch_tags: ["CSE"],
    city_tags: ["Mumbai", "Bangalore"],
    published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    fetched_at: new Date().toISOString(),
  },
  {
    id: "mock-2",
    source: "LiveMint",
    url: "https://livemint.com/education/startup-internship-stipends-india-2026",
    title: "Indian startup internship stipends up 40 percent in 2026, MBA students lead demand",
    excerpt:
      "A new report by Internshala shows median monthly stipends crossing Rs 18,000 for MBA interns at funded startups across Bangalore, Pune and Delhi.",
    image_url: null,
    branch_tags: ["MBA", "BBA"],
    city_tags: ["Bangalore", "Pune", "Delhi"],
    published_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    fetched_at: new Date().toISOString(),
  },
  {
    id: "mock-3",
    source: "The Hindu",
    url: "https://thehindu.com/sci-tech/semiconductor-policy-india-ecestudents",
    title: "India semiconductor mission opens 2,000 VLSI trainee roles for ECE graduates",
    excerpt:
      "The Ministry of Electronics has tied up with TSMC and Micron India to offer six-month paid traineeships for fresh ECE graduates in Hyderabad and Noida.",
    image_url: null,
    branch_tags: ["ECE", "Electrical"],
    city_tags: ["Hyderabad", "Noida"],
    published_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    fetched_at: new Date().toISOString(),
  },
  {
    id: "mock-4",
    source: "MoneyControl",
    url: "https://moneycontrol.com/news/business/ev-jobs-mechanical-engineering-2026",
    title: "EV boom creates 1.2 lakh new jobs for Mechanical and Electrical engineers by 2027",
    excerpt:
      "Ola Electric, Tata Motors and Ather report a surge in hiring for battery, powertrain and embedded systems roles as India targets 30 percent EV penetration.",
    image_url: null,
    branch_tags: ["Mechanical", "Electrical", "ECE"],
    city_tags: ["Pune", "Chennai", "Bangalore"],
    published_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    fetched_at: new Date().toISOString(),
  },
];

function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function fetchAndStoreNews(): Promise<{
  ok: boolean;
  inserted: number;
  error?: string;
}> {
  const client = getServiceClient();
  if (!client) {
    return { ok: false, inserted: 0, error: "no service role" };
  }

  let totalInserted = 0;

  for (const source of NEWS_SOURCES) {
    try {
      // Skip NewsAPI when no key
      if (source.type === "newsapi" && !NEWSAPI_KEY) continue;

      const fetchUrl =
        source.type === "newsapi"
          ? `${source.url}&apiKey=${NEWSAPI_KEY}`
          : source.url;

      const res = await fetch(fetchUrl, {
        headers: { "User-Agent": "Collab47-NewsBot/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;

      let articles: ParsedArticle[] = [];

      if (source.type === "rss") {
        const xml = await res.text();
        articles = parseRss(xml);
      } else if (source.type === "gdelt") {
        const json = await res.json();
        articles = parseGdelt(json);
      } else if (source.type === "newsapi") {
        // NewsAPI top-headlines response
        interface NewsApiResponse {
          articles?: Array<{
            title?: string;
            url?: string;
            description?: string;
            urlToImage?: string;
            publishedAt?: string;
          }>;
        }
        const json: NewsApiResponse = await res.json();
        if (json.articles) {
          for (const a of json.articles) {
            if (!a.title || !a.url) continue;
            articles.push({
              title: a.title,
              url: a.url,
              excerpt: (a.description ?? "").slice(0, 280),
              image_url: a.urlToImage ?? null,
              published_at: a.publishedAt
                ? new Date(a.publishedAt).toISOString()
                : new Date().toISOString(),
            });
          }
        }
      }

      if (articles.length === 0) continue;

      // Tag and prepare rows
      const rows = articles.map((a) => {
        const tags = tagArticle(a.title, a.excerpt);
        return {
          source: source.name,
          url: a.url,
          title: a.title,
          excerpt: a.excerpt || null,
          image_url: a.image_url,
          branch_tags: tags.branch_tags,
          city_tags: tags.city_tags,
          published_at: a.published_at,
          fetched_at: new Date().toISOString(),
        };
      });

      // Upsert ignoring duplicate URLs
      const { error, count } = await client
        .from("news_items")
        .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
        .select("id");

      if (!error) {
        totalInserted += count ?? rows.length;
      }
    } catch {
      // One bad source should not kill the run
      continue;
    }
  }

  return { ok: true, inserted: totalInserted };
}

export async function getNewsForUser(
  branch?: string,
  city?: string,
  limit = 10
): Promise<NewsItem[]> {
  const client = getServiceClient();
  if (!client) {
    // Mock fallback
    let items = MOCK_NEWS;
    if (branch) {
      items = items.filter((n) => n.branch_tags.includes(branch));
    }
    if (city) {
      items = items.filter((n) => n.city_tags.includes(city));
    }
    return items.slice(0, limit);
  }

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
  if (error || !data) {
    // Degrade to mock on query error
    return MOCK_NEWS.slice(0, limit);
  }

  return data as NewsItem[];
}
