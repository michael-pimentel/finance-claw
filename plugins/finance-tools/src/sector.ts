import { Type } from "typebox";
import { textResult } from "./types.js";
import { fetchPrices } from "./stock.js";

const SECTOR_ETFS: Record<string, string[]> = {
  semiconductors: ["SMH", "SOXX"],
  software: ["IGV"],
  consumer_tech: ["XLK"],
  broad_market: ["SPY", "QQQ"],
  auto_energy: ["DRIV"],
  social_ads: ["META", "SNAP"],
};

const SECTOR_LABELS: Record<string, string> = {
  semiconductors: "Semiconductors",
  software: "Software",
  consumer_tech: "Consumer Tech",
  broad_market: "Broad Market",
  auto_energy: "Auto/EV Energy",
  social_ads: "Social/Ads",
};

export function createFetchSectorPerformanceTool() {
  return {
    label: "Fetch Sector Performance",
    name: "fetch_sector_performance",
    description:
      "Use to determine if a price move is stock-specific or sector/market-wide. " +
      "Fetches performance of sector ETFs (SMH, SOXX, IGV, SPY, QQQ, etc.) to provide relative context. " +
      "Always call this alongside fetch_historical_prices for any mover >2% so you can distinguish " +
      "'everything is down' from 'this stock is specifically getting hit'. " +
      "Sectors: semiconductors, software, consumer_tech, social_ads, auto_energy, broad_market.",
    parameters: Type.Object({
      sector: Type.Union(
        [
          Type.Literal("semiconductors"),
          Type.Literal("software"),
          Type.Literal("consumer_tech"),
          Type.Literal("social_ads"),
          Type.Literal("auto_energy"),
          Type.Literal("broad_market"),
        ],
        { description: "Sector to check performance for" }
      ),
    }),
    execute: async (_id: string, params: { sector: string }) => {
      const apiKey = process.env["FINNHUB_API_KEY"];
      if (!apiKey) {
        return textResult("FINNHUB_API_KEY not set.", { error: "FINNHUB_API_KEY not configured" });
      }

      const etfs = SECTOR_ETFS[params.sector] ?? [];
      if (etfs.length === 0) {
        return textResult(`Unknown sector: ${params.sector}`, { error: "unknown_sector" });
      }

      // Also always include broad market for comparison unless that's what was requested
      const tickers =
        params.sector === "broad_market"
          ? etfs
          : [...new Set([...etfs, "SPY"])];

      const result = await fetchPrices(tickers, apiKey);

      const label = SECTOR_LABELS[params.sector] ?? params.sector;

      const sectorPrices = result.prices.filter((p) => etfs.includes(p.ticker));
      const spyPrice = result.prices.find((p) => p.ticker === "SPY");

      const sectorAvgChange =
        sectorPrices.length > 0
          ? sectorPrices.reduce((s, p) => s + p.change_pct, 0) / sectorPrices.length
          : null;

      const etfLines = result.prices
        .map((p) => {
          const sign = p.change_pct >= 0 ? "+" : "";
          return `${p.ticker}: ${sign}${p.change_pct.toFixed(2)}%`;
        })
        .join(", ");

      let relStrength = "";
      if (sectorAvgChange !== null && spyPrice && params.sector !== "broad_market") {
        const diff = sectorAvgChange - spyPrice.change_pct;
        if (Math.abs(diff) > 0.5) {
          relStrength =
            diff > 0
              ? ` Sector outperforming market by ${diff.toFixed(1)}%.`
              : ` Sector underperforming market by ${Math.abs(diff).toFixed(1)}%.`;
        }
      }

      const sign = sectorAvgChange !== null && sectorAvgChange >= 0 ? "+" : "";
      const summary =
        `${label} sector (${etfs.join("/")}): ` +
        (sectorAvgChange !== null ? `${sign}${sectorAvgChange.toFixed(2)}% avg. ` : "") +
        etfLines +
        "." +
        relStrength;

      return textResult(summary, {
        sector: params.sector,
        label,
        etfs: result.prices,
        errors: result.errors,
        sector_avg_change_pct: sectorAvgChange !== null ? +sectorAvgChange.toFixed(2) : null,
      });
    },
  };
}
