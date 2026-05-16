import { Type } from "typebox";
import { textResult } from "./types.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubInsiderTransaction {
  name: string;
  share: number;
  change: number;
  transactionPrice: number;
  transactionDate: string;
  transactionCode: string; // P = purchase, S = sale
}

interface FinnhubInsiderResponse {
  data: FinnhubInsiderTransaction[];
  symbol: string;
}

export function createFetchInsiderTradesTool() {
  return {
    label: "Fetch Insider Trades",
    name: "fetch_insider_trades",
    description:
      "Use when investigating a significant price move to check if insiders were buying or selling beforehand. " +
      "Returns insider transactions from the last 30 days with net direction (net_buying / net_selling / neutral). " +
      "Large insider sells before a drop are a major red flag. Large purchases signal executive confidence.",
    parameters: Type.Object({
      ticker: Type.String({ description: "Ticker symbol, e.g. 'NVDA'" }),
    }),
    execute: async (_id: string, params: { ticker: string }) => {
      const apiKey = process.env["FINNHUB_API_KEY"];
      if (!apiKey) {
        return textResult("FINNHUB_API_KEY not set.", { error: "FINNHUB_API_KEY not configured" });
      }

      const url =
        `${FINNHUB_BASE}/stock/insider-transactions` +
        `?symbol=${encodeURIComponent(params.ticker)}&token=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
      const raw = (await res.json()) as FinnhubInsiderResponse;

      if (!raw.data || raw.data.length === 0) {
        return textResult(`No insider transaction data found for ${params.ticker}.`, {
          ticker: params.ticker,
          recent_transactions: [],
          summary: { total_buys_30d: 0, total_sells_30d: 0, net_direction: "neutral", largest_transaction: "none" },
        });
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const recent = raw.data.filter((tx) => {
        if (!tx.transactionDate) return false;
        return new Date(tx.transactionDate) >= cutoff;
      });

      const transactions = recent.map((tx) => {
        const shares = Math.abs(tx.change || tx.share || 0);
        const price = tx.transactionPrice ?? 0;
        return {
          name: tx.name,
          title: tx.name,
          action: tx.transactionCode === "P" ? ("buy" as const) : ("sell" as const),
          shares,
          price,
          date: tx.transactionDate,
          value_usd: Math.round(shares * price),
        };
      });

      const buys = transactions.filter((t) => t.action === "buy");
      const sells = transactions.filter((t) => t.action === "sell");
      const totalBuyValue = buys.reduce((s, t) => s + t.value_usd, 0);
      const totalSellValue = sells.reduce((s, t) => s + t.value_usd, 0);

      const netDirection =
        totalBuyValue > totalSellValue * 1.5
          ? "net_buying"
          : totalSellValue > totalBuyValue * 1.5
          ? "net_selling"
          : "neutral";

      const largest = transactions.reduce(
        (best, t) => (t.value_usd > (best?.value_usd ?? 0) ? t : best),
        null as (typeof transactions)[0] | null
      );

      const largestDesc = largest
        ? `${largest.name} ${largest.action === "sell" ? "sold" : "bought"} $${(largest.value_usd / 1e6).toFixed(1)}M on ${largest.date}`
        : "none";

      const fmtM = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
      const summary =
        `${params.ticker} insider activity (30d): ` +
        (sells.length > 0 ? `${sells.length} sell${sells.length > 1 ? "s" : ""} totaling ${fmtM(totalSellValue)}` : "0 sells") +
        ", " +
        (buys.length > 0 ? `${buys.length} buy${buys.length > 1 ? "s" : ""} totaling ${fmtM(totalBuyValue)}` : "0 buys") +
        `. Net: ${netDirection.replace("_", " ")}. Largest: ${largestDesc}.`;

      return textResult(summary, {
        ticker: params.ticker,
        recent_transactions: transactions,
        summary: {
          total_buys_30d: totalBuyValue,
          total_sells_30d: totalSellValue,
          net_direction: netDirection,
          largest_transaction: largestDesc,
        },
      });
    },
  };
}
