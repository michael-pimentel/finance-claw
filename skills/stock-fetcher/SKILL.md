---
name: stock-fetcher
description: >
  Fetch current stock prices for watched tickers.
  Triggers when: heartbeat starts, "get prices", "check the market",
  "what's NVDA at", "how is the market doing", start of monitoring cycle,
  any ticker price question.
---

## How to Fetch Prices

Read `USER.md` to get the current watchlist. For each ticker:

1. Call `web_fetch` on `https://finance.yahoo.com/quote/{TICKER}`
   - Stocks: `https://finance.yahoo.com/quote/NVDA`
   - ETFs: `https://finance.yahoo.com/quote/SPY`
   - Crypto: `https://finance.yahoo.com/quote/BTC-USD`

2. From the returned page, locate and extract:
   - **Current price** — the large number near the top beside the ticker symbol
   - **% change** — shown as `+2.41%` or `-1.22%` directly below the price
   - **Volume** — in the statistics table labeled "Volume"

3. If `web_fetch` fails or the page does not load, record `ERROR: {TICKER} | fetch failed` and continue to the next ticker. Never abort the full batch.

## Output Format

Present results as a compact table before making any decisions:

```
NVDA    | $913.42 | +2.41% | vol 48M
TSLA    | $187.30 | -1.22% | vol 22M
AAPL    | $211.05 | +0.18% | vol 31M
SPY     | $524.60 | -0.31% | vol 89M
BTC-USD | $67,240 | -0.89% | vol N/A
ERROR   | FAKE    | fetch failed
```

## Next Step

Compare each ticker's `|% change|` against the threshold in `USER.md` (default 2.0%).

- If no ticker exceeds the threshold: output `Cycle complete — no significant movements.` and stop.
- If any ticker exceeds the threshold: list them as `FLAGGED: NVDA (+2.41%), TSLA (-3.8%)` and invoke the **news-analyzer** skill for each one.
