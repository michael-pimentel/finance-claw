import { Type } from "typebox";
import { textResult } from "./types.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];
  s: "ok" | "no_data";
}

function computeSMA(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  if (slice.length < period) return NaN;
  return slice.reduce((a, b) => a + b, 0) / period;
}

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return NaN;
  const deltas = closes.slice(-period - 1).map((v, i, arr) => (i === 0 ? 0 : v - arr[i - 1]!));
  const gains = deltas.slice(1).map((d) => (d > 0 ? d : 0));
  const losses = deltas.slice(1).map((d) => (d < 0 ? -d : 0));
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function pctDiff(current: number, reference: number): string {
  const diff = ((current - reference) / reference) * 100;
  const dir = diff >= 0 ? "above" : "below";
  return `${dir} by ${Math.abs(diff).toFixed(1)}%`;
}

export function createFetchHistoricalPricesTool() {
  return {
    label: "Fetch Historical Prices",
    name: "fetch_historical_prices",
    description:
      "Use when you need technical context — moving averages, RSI, volume patterns, support/resistance levels, " +
      "or trend direction over the past 60 days. Returns daily OHLCV candles plus computed signals: " +
      "20/50-day SMA, 14-period RSI, volume vs average, 52-week high/low, support and resistance. " +
      "Call this for any ticker that moved >2% before forming an opinion on the move.",
    parameters: Type.Object({
      ticker: Type.String({ description: "Ticker symbol, e.g. 'NVDA'" }),
      days: Type.Optional(
        Type.Number({ description: "Number of trading days to fetch (default 60)", minimum: 10, maximum: 365 })
      ),
    }),
    execute: async (_id: string, params: { ticker: string; days?: number }) => {
      const apiKey = process.env["FINNHUB_API_KEY"];
      if (!apiKey) {
        return textResult("FINNHUB_API_KEY not set.", { error: "FINNHUB_API_KEY not configured" });
      }

      const days = params.days ?? 60;
      const toTs = Math.floor(Date.now() / 1000);
      // Overshoot by 1.5x to account for weekends/holidays
      const fromTs = toTs - Math.floor(days * 1.5) * 86400;

      const url =
        `${FINNHUB_BASE}/stock/candle` +
        `?symbol=${encodeURIComponent(params.ticker)}` +
        `&resolution=D&from=${fromTs}&to=${toTs}&token=${apiKey}`;

      const res = await fetch(url);
      if (res.status === 403) {
        return textResult(
          `Historical candle data for ${params.ticker} is not available on your Finnhub plan (HTTP 403). ` +
            "Upgrade to a paid plan or use web_search to find historical context.",
          { ticker: params.ticker, error: "plan_restriction_403" }
        );
      }
      if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
      const raw = (await res.json()) as FinnhubCandle;

      if (raw.s === "no_data" || !raw.c || raw.c.length === 0) {
        return textResult(`No historical data available for ${params.ticker}.`, { ticker: params.ticker, error: "no_data" });
      }

      // Trim to requested days
      const len = Math.min(raw.c.length, days);
      const closes = raw.c.slice(-len);
      const highs = raw.h.slice(-len);
      const lows = raw.l.slice(-len);
      const opens = raw.o.slice(-len);
      const volumes = raw.v.slice(-len);
      const timestamps = raw.t.slice(-len);

      const candles = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open: opens[i]!,
        high: highs[i]!,
        low: lows[i]!,
        close: closes[i]!,
        volume: volumes[i]!,
      }));

      const current = closes[closes.length - 1]!;
      const ma20 = computeSMA(closes, 20);
      const ma50 = computeSMA(closes, 50);
      const rsi14 = computeRSI(closes, 14);

      const recent20Closes = closes.slice(-20);
      const recent20Highs = highs.slice(-20);
      const recent20Lows = lows.slice(-20);
      const recent20Volumes = volumes.slice(-20);
      const avg20Vol = recent20Volumes.reduce((a, b) => a + b, 0) / recent20Volumes.length;
      const todayVol = volumes[volumes.length - 1]!;
      const volRatio = todayVol / avg20Vol;

      const ftwHigh = Math.max(...highs);
      const ftwLow = Math.min(...lows);
      const pctFrom52wHigh = ((current - ftwHigh) / ftwHigh) * 100;

      const support = Math.min(...recent20Lows);
      const resistance = Math.max(...recent20Highs);

      // Count consecutive days below 20-day MA (from the end)
      let daysBelowMa20 = 0;
      for (let i = closes.length - 1; i >= 0; i--) {
        const maAt = computeSMA(closes.slice(0, i + 1), 20);
        if (isNaN(maAt) || closes[i]! >= maAt) break;
        daysBelowMa20++;
      }

      const volDesc =
        volRatio >= 1
          ? `${volRatio.toFixed(1)}x above average`
          : `${volRatio.toFixed(1)}x below average`;

      const rsiLabel =
        rsi14 < 30 ? "oversold" : rsi14 > 70 ? "overbought" : rsi14 < 40 ? "approaching oversold" : rsi14 > 60 ? "approaching overbought" : "neutral";

      const summary =
        `${params.ticker} ${days}-day context: Currently $${current.toFixed(2)}, ` +
        `${pctDiff(current, ma20)} 20-day MA ($${ma20.toFixed(2)})` +
        (daysBelowMa20 > 0 ? ` — ${daysBelowMa20} consecutive sessions below MA20` : "") +
        `. RSI ${rsi14.toFixed(0)} (${rsiLabel}). ` +
        `Volume ${volDesc}. ` +
        `Trading ${Math.abs(pctFrom52wHigh).toFixed(1)}% below 52-week high ($${ftwHigh.toFixed(2)}). ` +
        `Support ~$${support.toFixed(2)} (20-day low), resistance ~$${resistance.toFixed(2)} (20-day high).`;

      const result = {
        ticker: params.ticker,
        candles,
        technicals: {
          ma_20: +ma20.toFixed(2),
          ma_50: +ma50.toFixed(2),
          rsi_14: +rsi14.toFixed(1),
          current_vs_ma20: pctDiff(current, ma20),
          current_vs_ma50: pctDiff(current, ma50),
          days_below_ma20: daysBelowMa20,
          avg_volume_20d: Math.round(avg20Vol),
          volume_vs_avg: volDesc,
          fifty_two_week_high: +ftwHigh.toFixed(2),
          fifty_two_week_low: +ftwLow.toFixed(2),
          pct_from_52w_high: +pctFrom52wHigh.toFixed(2),
          support_level: +support.toFixed(2),
          resistance_level: +resistance.toFixed(2),
        },
      };

      return textResult(summary, result);
    },
  };
}
