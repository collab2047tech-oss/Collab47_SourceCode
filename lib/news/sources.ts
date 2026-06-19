/**
 * News source definitions.
 * Each source has a name, type, and url.
 * GDELT and NewsAPI are JSON; RSS sources are XML parsed inline.
 */

export type SourceType = "rss" | "gdelt" | "newsapi";

export interface NewsSource {
  name: string;
  type: SourceType;
  url: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  // NOTE: Indian Express /feed/ ships empty <description>/<content> (title-only),
  // producing cards with no summary. Dropped. Indian coverage still comes from
  // The Hindu, LiveMint, NewsData, GNews, Mediastack (all carry article text).
  {
    name: "The Hindu",
    type: "rss",
    url: "https://www.thehindu.com/feeder/default.rss",
  },
  {
    name: "LiveMint",
    type: "rss",
    url: "https://www.livemint.com/rss/news",
  },
  {
    name: "MoneyControl",
    type: "rss",
    url: "https://www.moneycontrol.com/rss/latestnews.xml",
  },
  {
    name: "Hacker News",
    type: "rss",
    url: "https://hnrss.org/frontpage",
  },
  {
    name: "GDELT",
    type: "gdelt",
    url: "https://api.gdeltproject.org/api/v2/doc/doc?query=india%20students&mode=ArtList&format=json&maxrecords=20",
  },
  {
    name: "NewsAPI",
    type: "newsapi",
    url: "https://newsapi.org/v2/top-headlines?country=in",
  },
];
