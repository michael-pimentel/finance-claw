import { Type } from "typebox";
import { textResult, type NewsItem } from "./types.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubNewsItem {
  datetime: number; // unix timestamp
  headline: string;
  source: string;
  url: string;
  summary: string;
}

function extractTicker(query: string): string {
  // query is always "TICKER Company Name" — first token is the symbol
  return query.split(/\s+/)[0]!.toUpperCase();
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function fetchNews(
  ticker: string,
  hoursBack: number,
  apiKey: string
): Promise<NewsItem[]> {
  const to = new Date();
  const from = new Date(to.getTime() - hoursBack * 60 * 60 * 1000);

  const url =
    `${FINNHUB_BASE}/company-news` +
    `?symbol=${encodeURIComponent(ticker)}` +
    `&from=${dateString(from)}` +
    `&to=${dateString(to)}` +
    `&token=${apiKey}`;

  const res = await fetch(url);

  if (res.status === 429) {
    return []; // rate limited — return empty rather than crash
  }

  if (!res.ok) {
    throw new Error(`Finnhub news HTTP ${res.status}`);
  }

  const raw = (await res.json()) as FinnhubNewsItem[];

  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item) => item.headline && item.url)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 10)
    .map((item) => ({
      title: item.headline,
      source: item.source,
      url: item.url,
      published_at: new Date(item.datetime * 1000).toISOString(),
      description: item.summary ?? "",
    }));
}

function buildNewsSummary(ticker: string, articles: NewsItem[], hoursBack: number): string {
  if (articles.length === 0) {
    return `No news found for ${ticker} in the last ${hoursBack}h. The price move may be technical or driven by broader market action.`;
  }

  const lines = articles.map((a, i) => {
    const time = new Date(a.published_at).toUTCString();
    return `${i + 1}. [${a.source}] ${a.title} (${time})\n   ${a.description ? a.description.slice(0, 200) : "No summary."}\n   ${a.url}`;
  });

  return `Found ${articles.length} article(s) for ${ticker} in the last ${hoursBack}h:\n\n${lines.join("\n\n")}`;
}

export function createFetchNewsTool() {
  return {
    label: "Fetch News",
    name: "fetch_news",
    description:
      "Fetches recent news articles for a stock ticker from Finnhub. " +
      "Use this to investigate a ticker after detecting a significant price move. " +
      "Returns up to 10 articles sorted by recency. Each article includes title, source, URL, publish time, and description. " +
      "hours_back controls how far back to search (default 24). " +
      "Do NOT call this for tickers that did not trigger the movement threshold.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query combining ticker symbol and company name, e.g. 'NVDA NVIDIA'",
        minLength: 1,
      }),
      hours_back: Type.Optional(
        Type.Number({
          description: "How many hours back to search for news. Default: 24. Max: 72.",
          minimum: 1,
          maximum: 72,
        })
      ),
    }),
    execute: async (_id: string, params: { query: string; hours_back?: number }) => {
      const apiKey = process.env["FINNHUB_API_KEY"];
      if (!apiKey) {
        return textResult(
          "FINNHUB_API_KEY is not set. Add it to .env.",
          { articles: [], error: "FINNHUB_API_KEY not configured" }
        );
      }

      const ticker = extractTicker(params.query);
      const hoursBack = params.hours_back ?? 24;

      const articles = await fetchNews(ticker, hoursBack, apiKey);
      return textResult(buildNewsSummary(ticker, articles, hoursBack), { articles });
    },
  };
}
