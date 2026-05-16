import { Type } from "typebox";
import { textResult, type PriceData, type PriceFetchResult } from "./types.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubQuote {
  c: number;         // current price
  d: number | null;  // absolute change since previous close
  dp: number | null; // percent change since previous close
  h: number;         // day high
  l: number;         // day low
  o: number;         // open
  pc: number;        // previous close
  t: number;         // unix timestamp (seconds)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuote(ticker: string, apiKey: string): Promise<PriceData> {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`;

  let res = await fetch(url);

  if (res.status === 429) {
    await sleep(200);
    res = await fetch(url); // one retry on rate limit
  }

  if (!res.ok) {
    throw new Error(`Finnhub HTTP ${res.status}`);
  }

  const data = (await res.json()) as FinnhubQuote;

  // Finnhub silently returns c=0, dp=null for unknown tickers (HTTP 200)
  if (data.c === 0 && data.dp === null) {
    throw new Error("ticker not found");
  }

  return {
    ticker,
    price: data.c,
    change_pct: data.dp ?? 0,
    change_abs: data.d ?? 0,
    currency: "USD",
    timestamp: new Date(data.t * 1000).toISOString(),
  };
}

export async function fetchPrices(tickers: string[], apiKey: string): Promise<PriceFetchResult> {
  const settled = await Promise.allSettled(tickers.map((t) => fetchQuote(t, apiKey)));

  const prices: PriceData[] = [];
  const errors: Array<{ ticker: string; error: string }> = [];

  settled.forEach((result, i) => {
    const ticker = tickers[i]!;
    if (result.status === "fulfilled") {
      prices.push(result.value);
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push({ ticker, error: msg });
    }
  });

  return { prices, errors };
}

export function buildSummary(result: PriceFetchResult): string {
  const total = result.prices.length + result.errors.length;
  const parts: string[] = [`Fetched ${result.prices.length} of ${total} tickers successfully.`];

  if (result.prices.length > 0) {
    const list = result.prices
      .map((p) => {
        const sign = p.change_pct >= 0 ? "+" : "";
        return `${p.ticker}: ${p.price.toFixed(2)} (${sign}${p.change_pct.toFixed(2)}%)`;
      })
      .join(", ");
    parts.push(list + ".");
  }

  if (result.errors.length > 0) {
    const list = result.errors.map((e) => `${e.ticker} (${e.error})`).join(", ");
    parts.push(`Failed: ${list}.`);
  }

  return parts.join(" ");
}

export function createFetchPricesTool() {
  return {
    label: "Fetch Prices",
    name: "fetch_prices",
    description:
      "Fetches current stock prices for one or more ticker symbols from Finnhub. " +
      "Returns current price, absolute change, and percentage change since last close for each ticker. " +
      "Call this at the START of every monitoring cycle and for any question about current prices or price movements. " +
      "Fetch ALL watchlist tickers in a single call — never call this per-ticker. " +
      "Tickers that fail are included in the 'errors' array; do not abort if some fail. " +
      "Do NOT call this more than once per cycle — the data is already current.",
    parameters: Type.Object({
      tickers: Type.Array(Type.String(), {
        description: "Ticker symbols to fetch, e.g. ['NVDA', 'MSFT', 'AAPL']",
        minItems: 1,
      }),
    }),
    execute: async (_id: string, params: { tickers: string[] }) => {
      const apiKey = process.env["FINNHUB_API_KEY"];
      if (!apiKey) {
        return textResult(
          "FINNHUB_API_KEY is not set. Get a free key at finnhub.io and add it to .env.",
          { prices: [], errors: [{ ticker: "*", error: "FINNHUB_API_KEY not configured" }] }
        );
      }

      const result = await fetchPrices(params.tickers, apiKey);
      return textResult(buildSummary(result), result);
    },
  };
}
