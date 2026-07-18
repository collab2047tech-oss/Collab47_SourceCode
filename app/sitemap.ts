import type { MetadataRoute } from "next";
import { getAdminClient } from "@/lib/supabase/admin";

const BASE_URL = "https://collab47.com";

// Refresh the map hourly so freshly-published news and new profiles get
// discovered without waiting for a redeploy.
export const revalidate = 3600;

// Static public routes always present in the map.
function staticRoutes(now: Date): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/manifesto`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}

// Dynamic sitemap: static routes + real public content (news stories, hashtag
// pages, public profiles) pulled from the DB so search engines discover the long
// tail. Fails safe to the static list if the DB is unavailable.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base = staticRoutes(now);

  const admin = getAdminClient();
  if (!admin) return base;

  try {
    const [newsRes, tagRes, profRes] = await Promise.all([
      admin
        .from("news_items")
        .select("id, published_at")
        .order("published_at", { ascending: false })
        .limit(1000),
      admin.from("hashtags").select("tag").limit(1000),
      admin
        .from("profiles")
        .select("handle, updated_at")
        .is("deleted_at", null)
        .is("suspended_at", null)
        .not("privacy->>searchable", "eq", "false")
        .limit(2000),
    ]);

    const news: MetadataRoute.Sitemap = (newsRes.data ?? []).map((n) => ({
      url: `${BASE_URL}/news/${n.id as string}`,
      lastModified: n.published_at ? new Date(n.published_at as string) : now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    const tags: MetadataRoute.Sitemap = (tagRes.data ?? []).map((t) => ({
      url: `${BASE_URL}/t/${encodeURIComponent(t.tag as string)}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    }));

    const profiles: MetadataRoute.Sitemap = (profRes.data ?? []).map((p) => ({
      url: `${BASE_URL}/u/${p.handle as string}`,
      lastModified: p.updated_at ? new Date(p.updated_at as string) : now,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [...base, ...news, ...tags, ...profiles];
  } catch {
    return base;
  }
}
