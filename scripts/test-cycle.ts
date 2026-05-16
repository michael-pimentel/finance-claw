// Manual end-to-end cycle test — runs a monitoring cycle without the agent model.
// Usage: pnpm --filter finance-tools test:cycle
//
// Loads .env from the repo root (OpenClaw_Hacks/), then runs the full pipeline:
// 1. fetch_prices for the watchlist
// 2. Identify tickers crossing the threshold
// 3. fetch_news for each qualifying ticker
// 4. check_recent_alerts
// 5. send_alert (Telegram if configured, otherwise local-only)

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, "../.env");
process.loadEnvFile(envPath);

import { fetchPrices, buildSummary } from "../plugins/finance-tools/src/stock.js";
import { getWatchlist, getRecentAlerts, recordAlert } from "../plugins/finance-tools/src/memory.js";

const THRESHOLD_PCT = parseFloat(process.env["MOVEMENT_THRESHOLD_PCT"] ?? "2.0");

async function runCycle() {
  const apiKey = process.env["FINNHUB_API_KEY"];
  if (!apiKey) {
    console.error("FINNHUB_API_KEY not set — aborting.");
    process.exit(1);
  }

  const tickers = getWatchlist();
  console.log(`=== FinanceClaw Cycle Test ===`);
  console.log(`Watchlist: ${tickers.join(", ")}`);
  console.log(`Threshold: ±${THRESHOLD_PCT}%`);
  console.log();

  // Step 1: Fetch prices
  const result = await fetchPrices(tickers, apiKey);
  console.log("=== Prices ===");
  console.log(buildSummary(result));
  console.log();

  // Step 2: Find movers
  const movers = result.prices.filter((p) => Math.abs(p.change_pct) >= THRESHOLD_PCT);
  if (movers.length === 0) {
    console.log(`No tickers moved ≥${THRESHOLD_PCT}% — cycle complete, no alerts needed.`);
    return;
  }

  console.log(`=== Movers (≥${THRESHOLD_PCT}%) ===`);
  for (const p of movers) {
    const sign = p.change_pct >= 0 ? "+" : "";
    console.log(`  ${p.ticker}: ${sign}${p.change_pct.toFixed(2)}% ($${p.price.toFixed(2)})`);
  }
  console.log();

  // Step 3: Check recent alerts and decide
  for (const p of movers) {
    const windowHours = Math.abs(p.change_pct) > 8 ? 4 : 24;
    const recent = getRecentAlerts(p.ticker, windowHours);

    if (recent.length > 0) {
      console.log(`${p.ticker}: skipped — alert already sent within ${windowHours}h`);
      console.log(`  Last: "${recent[0]!.summary}" at ${recent[0]!.created_at}`);
      continue;
    }

    const sign = p.change_pct >= 0 ? "+" : "";
    const summary = `[TEST] ${p.ticker} moved ${sign}${p.change_pct.toFixed(2)}% — monitoring cycle test alert.`;

    console.log(`${p.ticker}: recording test alert`);
    console.log(`  Summary: ${summary}`);

    // Record locally only (no Telegram in test mode)
    recordAlert(p.ticker, summary, p.change_pct);
    console.log(`  Recorded to local SQLite DB.`);
    console.log();
  }

  console.log("=== Cycle complete ===");
}

runCycle().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
