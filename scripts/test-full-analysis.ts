// Full analysis pipeline test — runs all five intelligence tools against NVDA.
// Usage: pnpm test:analysis
//
// Calls Finnhub directly (no OpenClaw wrapper) to verify real data flows through
// each new tool before the demo.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, "../.env");
process.loadEnvFile(envPath);

import { fetchPrices, buildSummary } from "../plugins/finance-tools/src/stock.js";
import { createFetchHistoricalPricesTool } from "../plugins/finance-tools/src/historical.js";
import { createFetchInsiderTradesTool } from "../plugins/finance-tools/src/insider.js";
import { createFetchEarningsCalendarTool } from "../plugins/finance-tools/src/earnings.js";
import { createFetchSectorPerformanceTool } from "../plugins/finance-tools/src/sector.js";

const TICKER = "NVDA";
const SEP = "─".repeat(60);

function header(title: string) {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

async function runTool(tool: ReturnType<typeof createFetchHistoricalPricesTool>, params: object) {
  // @ts-expect-error — execute takes (_id, params), we pass a dummy id
  return tool.execute("test", params);
}

async function safeRunTool(
  label: string,
  tool: ReturnType<typeof createFetchHistoricalPricesTool>,
  params: object
) {
  try {
    return await runTool(tool, params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [${label}] tool threw: ${msg}`);
    return null;
  }
}

async function main() {
  const apiKey = process.env["FINNHUB_API_KEY"];
  if (!apiKey) {
    console.error("FINNHUB_API_KEY not set in .env — aborting.");
    process.exit(1);
  }

  console.log(`\nFinanceClaw Full Analysis Pipeline — ${TICKER}`);
  console.log(`Run at: ${new Date().toISOString()}`);

  // 1. Current price
  header("1. CURRENT PRICE (fetch_prices)");
  const priceResult = await fetchPrices([TICKER], apiKey);
  console.log(buildSummary(priceResult));
  console.log(JSON.stringify(priceResult.prices[0], null, 2));

  // 2. Historical / technicals
  header("2. HISTORICAL & TECHNICALS (fetch_historical_prices)");
  const histTool = createFetchHistoricalPricesTool();
  const histResult = await safeRunTool("historical", histTool, { ticker: TICKER, days: 60 });
  if (histResult) {
    console.log(histResult.content[0].text);
    const histData = histResult.details as { technicals?: object; candles?: unknown[] };
    if (histData.technicals) {
      console.log("\nTechnicals:", JSON.stringify(histData.technicals, null, 2));
      console.log(`Candles returned: ${histData.candles?.length ?? 0} days`);
      const candles = histData.candles ?? [];
      console.log("Most recent candle:", JSON.stringify(candles[candles.length - 1], null, 2));
    }
  }

  // 3. Sector performance
  header("3. SECTOR PERFORMANCE (fetch_sector_performance)");
  const sectorTool = createFetchSectorPerformanceTool();
  const sectorResult = await safeRunTool("sector", sectorTool, { sector: "semiconductors" });
  if (sectorResult) console.log(sectorResult.content[0].text);
  console.log("\nBroad market comparison:");
  const broadResult = await safeRunTool("broad_market", sectorTool, { sector: "broad_market" });
  if (broadResult) console.log(broadResult.content[0].text);

  // 4. Insider trades
  header("4. INSIDER TRADES (fetch_insider_trades)");
  const insiderTool = createFetchInsiderTradesTool();
  const insiderResult = await safeRunTool("insider", insiderTool, { ticker: TICKER });
  if (insiderResult) {
    console.log(insiderResult.content[0].text);
    const insiderData = insiderResult.details as { recent_transactions: unknown[]; summary: object };
    console.log(`\nTransactions in last 30d: ${insiderData.recent_transactions.length}`);
    console.log("Summary:", JSON.stringify(insiderData.summary, null, 2));
    if (insiderData.recent_transactions.length > 0) {
      console.log("Recent transactions:", JSON.stringify(insiderData.recent_transactions.slice(0, 3), null, 2));
    }
  }

  // 5. Earnings calendar
  header("5. EARNINGS CALENDAR (fetch_earnings_calendar)");
  const earningsTool = createFetchEarningsCalendarTool();
  const earningsResult = await safeRunTool("earnings", earningsTool, { ticker: TICKER });
  if (earningsResult) {
    console.log(earningsResult.content[0].text);
    console.log("\nDetails:", JSON.stringify(earningsResult.details, null, 2));
  }

  // Summary assessment
  header("PIPELINE COMPLETE");
  const price = priceResult.prices[0];
  if (price) {
    const sign = price.change_pct >= 0 ? "+" : "";
    console.log(`${TICKER} is at $${price.price.toFixed(2)} (${sign}${price.change_pct.toFixed(2)}% today)`);
  }
  console.log("All tools executed successfully. Ready for demo.\n");
}

main().catch((err) => {
  console.error("\nPipeline error:", err);
  process.exit(1);
});
