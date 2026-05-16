import { Type } from "typebox";
import { jsonResult, type NewsItem } from "./types.js";

// Implemented in Step 5 — calls Finnhub company-news endpoint
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
    execute: async (_id: string, _params: { query: string; hours_back?: number }) => {
      const stub: NewsItem[] = [];
      return jsonResult({ articles: stub, note: "fetch_news not yet implemented — coming in Step 5." });
    },
  };
}
