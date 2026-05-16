// Re-export SDK result helpers so tool files import from one place
export { jsonResult } from "openclaw/plugin-sdk/core";

// Local textResult — returns the correct AgentToolResult shape without importing
// the agent-runtime mega-barrel. TextContent = { type: "text"; text: string }.
export function textResult<T>(summary: string, data: T) {
  return {
    content: [{ type: "text" as const, text: summary }],
    details: data,
  };
}

export interface PriceData {
  ticker: string;
  price: number;
  change_pct: number;
  change_abs: number;
  currency: string;
  timestamp: string;
  error?: string;
}

export interface PriceFetchResult {
  prices: PriceData[];
  errors: Array<{ ticker: string; error: string }>;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  published_at: string;
  description: string;
}

export interface AlertPayload {
  ticker: string;
  summary: string;
  change_pct: number;
  headline?: string;
  url?: string;
}

export interface AlertRecord {
  id: number;
  ticker: string;
  summary: string;
  change_pct: number | null;
  created_at: string;
}
