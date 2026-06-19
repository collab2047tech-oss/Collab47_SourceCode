/**
 * Lightweight RSS/GDELT parsers.
 * No external XML library. Uses regex/string operations only.
 */

export interface ParsedArticle {
  title: string;
  url: string;
  excerpt: string;
  image_url: string | null;
  published_at: string;
  /** Longer source text (article body / content) used to generate summaries. */
  content?: string;
}

/** Strip CDATA wrappers from a string */
function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/** Strip all HTML tags */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Decode common HTML entities */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanText(raw: string): string {
  return decodeEntities(stripHtml(stripCdata(raw))).trim();
}

/** Pull the first capture of a regex out of a string. Returns "" if not found. */
function extract(pattern: RegExp, src: string): string {
  const m = src.match(pattern);
  return m ? m[1].trim() : "";
}

/**
 * Parse an RSS/Atom XML string into article objects.
 * Handles: <item> blocks, CDATA, HTML entities, enclosure, media:content.
 */
export function parseRss(xml: string): ParsedArticle[] {
  const results: ParsedArticle[] = [];

  // Extract all <item>...</item> blocks
  const itemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];

    // Title: capture between tags, handle CDATA
    const rawTitle = extract(/<title[^>]*>([\s\S]*?)<\/title>/i, block);
    const title = cleanText(rawTitle);
    if (!title) continue;

    // URL: prefer <link> text content; some feeds use <link href="..."/>
    let url = extract(/<link>([\s\S]*?)<\/link>/i, block);
    if (!url) {
      url = extract(/<link[^>]+href="([^"]+)"/i, block);
    }
    url = cleanText(url);
    if (!url || !url.startsWith("http")) continue;

    // Excerpt from <description>
    const rawDesc = extract(/<description[^>]*>([\s\S]*?)<\/description>/i, block);
    const excerpt = cleanText(rawDesc).slice(0, 280);

    // Image: try <enclosure url="..."> first, then <media:content url="...">
    let image_url: string | null = null;
    const enclosure = extract(/<enclosure[^>]+url="([^"]+)"/i, block);
    if (enclosure && /\.(jpg|jpeg|png|webp|gif)/i.test(enclosure)) {
      image_url = enclosure;
    }
    if (!image_url) {
      const media = extract(/<media:content[^>]+url="([^"]+)"/i, block);
      if (media && /\.(jpg|jpeg|png|webp|gif)/i.test(media)) {
        image_url = media;
      }
    }
    if (!image_url) {
      // fallback: try og:image or any img src inside description
      const imgSrc = extract(/<img[^>]+src="([^"]+)"/i, rawDesc);
      if (imgSrc) image_url = imgSrc;
    }

    // published_at from <pubDate>
    const pubDateRaw = extract(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i, block);
    let published_at: string;
    if (pubDateRaw) {
      const parsed = new Date(cleanText(pubDateRaw));
      published_at = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    } else {
      published_at = new Date().toISOString();
    }

    results.push({ title, url, excerpt, image_url, published_at });
  }

  return results;
}

/**
 * GDELT ArtList JSON structure:
 * { articles: [{ title, url, seendate, socialimage, domain, language, ... }] }
 */
interface GdeltArticle {
  title?: string;
  url?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

export function parseGdelt(json: unknown): ParsedArticle[] {
  const data = json as GdeltResponse;
  if (!data || !Array.isArray(data.articles)) return [];

  const results: ParsedArticle[] = [];

  for (const item of data.articles) {
    const title = (item.title ?? "").trim();
    const url = (item.url ?? "").trim();
    if (!title || !url || !url.startsWith("http")) continue;

    // GDELT seendate format: "20250611T120000Z"
    let published_at: string;
    if (item.seendate) {
      // Normalize "20250611T120000Z" to ISO format
      const sd = item.seendate.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/,
        "$1-$2-$3T$4:$5:$6Z"
      );
      const parsed = new Date(sd);
      published_at = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    } else {
      published_at = new Date().toISOString();
    }

    const image_url = item.socialimage ? item.socialimage.trim() : null;

    results.push({
      title,
      url,
      excerpt: "",
      image_url: image_url && image_url.startsWith("http") ? image_url : null,
      published_at,
    });
  }

  return results;
}
