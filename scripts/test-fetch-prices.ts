// Manual test for the fetch_prices tool — runs against real Finnhub API.
// Usage: pnpm --filter finance-tools test:prices
//
// Loads .env from the repo root (OpenClaw_Hacks/), then calls fetchPrices
// directly without going through the OpenClaw plugin wrapper.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load env from finance-claw/.env (one level up from finance-claw/scripts/)
const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, "../.env");
process.loadEnvFile(envPath);

import { fetchPrices, buildSummary } from "../plugins/finance-tools/src/stock.js";

const TEST_TICKERS = ["NVDA", "MSFT", "AAPL", "GOOGL", "META", "ZZZZ"];

async function main() {
  const apiKey = process.env["FINNHUB_API_KEY"];
  if (!apiKey) {
    console.error("FINNHUB_API_KEY not set in .env — aborting.");
    process.exit(1);
  }

  console.log(`Fetching prices for: ${TEST_TICKERS.join(", ")}\n`);

  const start = Date.now();
  const result = await fetchPrices(TEST_TICKERS, apiKey);
  const elapsed = Date.now() - start;

  console.log("=== Human-readable summary (what the agent sees) ===");
  console.log(buildSummary(result));
  console.log();

  console.log("=== Structured data (details payload) ===");
  console.log(JSON.stringify(result, null, 2));
  console.log();

  console.log(`Completed in ${elapsed}ms.`);
  console.log(`  Successful: ${result.prices.length}`);
  console.log(`  Failed:     ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log("\nExpected failures:");
    for (const e of result.errors) {
      console.log(`  ${e.ticker}: ${e.error}`);
    }
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
