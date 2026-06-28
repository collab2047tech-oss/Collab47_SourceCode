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
  // REMOVED: Hacker News (hnrss.org/frontpage). Its <description> is pure
  // metadata - "Article URL: ... Comments URL: ... Points: N # Comments: N" -
  // with no article body. That boilerplate leaked into excerpts/summaries and
  // rendered as junk cards. A headline-only tech feed isn't worth that risk.
  // NOTE: The GDELT "india students" source and the legacy NewsAPI
  // top-headlines feed were removed in Phase 4. They shipped image-less,
  // body-less, frequently off-topic items (the worst "trash" cards). Indian
  // coverage now comes from The Hindu, LiveMint, MoneyControl and the keyed
  // JSON APIs (NewsData / GNews / Mediastack / NYT / Guardian) which all carry
  // real article text.
];
