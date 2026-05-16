import { Type } from "typebox";
import { textResult } from "./types.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubEarningsEvent {
  date: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
  quarter: number;
  year: number;
}

interface FinnhubEarningsResponse {
  earningsCalendar: FinnhubEarningsEvent[];
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function quarterLabel(q: number, y: number): string {
  return `Q${q} ${y}`;
}

export function createFetchEarningsCalendarTool() {
  return {
    label: "Fetch Earnings Calendar",
    name: "fetch_earnings_calendar",
    description:
      "Use to check if earnings are upcoming, which affects how you interpret price moves. " +
      "Returns the next earnings date, EPS/revenue estimates, and whether the ticker is in the earnings window " +
      "(within 7 days). Moves near earnings are often positioning, not panic — always check this before assessing volatility.",
    parameters: Type.Object({
      ticker: Type.String({ description: "Ticker symbol, e.g. 'NVDA'" }),
    }),
    execute: async (_id: string, params: { ticker: string }) => {
      const apiKey = process.env["FINNHUB_API_KEY"];
      if (!apiKey) {
        return textResult("FINNHUB_API_KEY not set.", { error: "FINNHUB_API_KEY not configured" });
      }

      const today = new Date();
      const plus30 = new Date(today);
      plus30.setDate(plus30.getDate() + 30);

      const url =
        `${FINNHUB_BASE}/calendar/earnings` +
        `?symbol=${encodeURIComponent(params.ticker)}` +
        `&from=${toDateStr(today)}&to=${toDateStr(plus30)}&token=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
      const raw = (await res.json()) as FinnhubEarningsResponse;

      const events = raw.earningsCalendar ?? [];
      const upcoming = events
        .filter((e) => e.date >= toDateStr(today))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (upcoming.length === 0) {
        const result = {
          ticker: params.ticker,
          upcoming_earnings: null,
          days_until_earnings: null,
          in_earnings_window: false,
        };
        return textResult(`${params.ticker}: No earnings scheduled in the next 30 days.`, result);
      }

      const next = upcoming[0]!;
      const nextDate = new Date(next.date + "T00:00:00Z");
      const msPerDay = 86400000;
      const daysUntil = Math.round((nextDate.getTime() - today.getTime()) / msPerDay);
      const inWindow = daysUntil <= 7;

      const result = {
        ticker: params.ticker,
        upcoming_earnings: {
          date: next.date,
          quarter: quarterLabel(next.quarter, next.year),
          eps_estimate: next.epsEstimate ?? null,
          revenue_estimate: next.revenueEstimate ?? null,
        },
        days_until_earnings: daysUntil,
        in_earnings_window: inWindow,
      };

      const epsStr = next.epsEstimate != null ? ` EPS estimate: $${next.epsEstimate.toFixed(2)}.` : "";
      const revStr =
        next.revenueEstimate != null
          ? ` Revenue estimate: $${(next.revenueEstimate / 1e9).toFixed(2)}B.`
          : "";
      const windowStr = inWindow ? " ⚠️ In earnings window — elevated volatility expected." : "";

      const summary =
        `${params.ticker} earnings: ${quarterLabel(next.quarter, next.year)} report expected ${next.date} ` +
        `(${daysUntil} day${daysUntil !== 1 ? "s" : ""}).` +
        epsStr +
        revStr +
        windowStr;

      return textResult(summary, result);
    },
  };
}
