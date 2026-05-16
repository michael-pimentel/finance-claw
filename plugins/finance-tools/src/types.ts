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

export interface CandleBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Technicals {
  ma_20: number;
  ma_50: number;
  rsi_14: number;
  current_vs_ma20: string;
  current_vs_ma50: string;
  days_below_ma20: number;
  avg_volume_20d: number;
  volume_vs_avg: string;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  pct_from_52w_high: number;
  support_level: number;
  resistance_level: number;
}

export interface HistoricalResult {
  ticker: string;
  candles: CandleBar[];
  technicals: Technicals;
}

export interface InsiderTransaction {
  name: string;
  title: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  date: string;
  value_usd: number;
}

export interface InsiderResult {
  ticker: string;
  recent_transactions: InsiderTransaction[];
  summary: {
    total_buys_30d: number;
    total_sells_30d: number;
    net_direction: "net_buying" | "net_selling" | "neutral";
    largest_transaction: string;
  };
}

export interface EarningsResult {
  ticker: string;
  upcoming_earnings: {
    date: string;
    quarter: string;
    eps_estimate: number | null;
    revenue_estimate: number | null;
  } | null;
  days_until_earnings: number | null;
  in_earnings_window: boolean;
}
