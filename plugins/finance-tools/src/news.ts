import { Type } from "typebox";
import { jsonResult, type NewsItem } from "./types.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// Extract the first ticker-like token from a query string, e.g. "NVDA NVIDIA" → "NVDA"
function extractTicker(query: string): string {
  const parts = query.trim().split(/\s+/);
  return (parts[0] ?? query).toUpperCase();
}

async function fetchFinnhubNews(
  ticker: string,
  hoursBack: number,
  apiKey: string
): Promise<NewsItem[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - hoursBack * 3600;

  const fromDate = new Date(from * 1000).toISOString().slice(0, 10);
  const toDate = new Date(now * 1000).toISOString().slice(0, 10);

  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(ticker)}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Finnhub HTTP ${res.status}`);
  }

  const data = (await res.json()) as FinnhubNewsItem[];

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data
    .slice(0, 10)
    .map((item) => ({
      title: item.headline,
      source: item.source,
      url: item.url,
      published_at: new Date(item.datetime * 1000).toISOString(),
      description: item.summary?.slice(0, 300) ?? "",
    }));
}

export function createFetchNewsTool() {
  return {
    label: "Fetch News",
    name: "fetch_news",
    description:
      "Fetches recent news articles matching a search query. " +
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
        return jsonResult({
          articles: [],
          note: "FINNHUB_API_KEY is not set — cannot fetch news. Get a free key at finnhub.io.",
        });
      }

      const ticker = extractTicker(params.query);
      const hoursBack = Math.min(params.hours_back ?? 24, 72);

      try {
        const articles = await fetchFinnhubNews(ticker, hoursBack, apiKey);
        return jsonResult({ articles, count: articles.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResult({ articles: [], error: msg });
      }
    },
  };
}
