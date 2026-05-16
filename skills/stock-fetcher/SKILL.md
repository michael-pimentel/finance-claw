# Skill: stock-fetcher

Fetches current stock prices for the watchlist tickers.

## Script

```
python scripts/fetch_prices.py NVDA TSLA AAPL SPY BTC-USD
```

## Output Format

One line per ticker:
```
TICKER | price | change_pct% | volume | timestamp
```

Example:
```
NVDA | 875.42 | +2.31% | 48291034 | 2024-05-15T14:32:00Z
TSLA | 178.90 | -1.05% | 91234567 | 2024-05-15T14:32:00Z
ERROR: BTC-USD | ticker not found via yfinance
```

## Data Source

Primary: `yfinance` (free, no key required)
Fallback: Finnhub REST API (`FINNHUB_API_KEY` env var)

## Error Handling

- Bad ticker: print `ERROR: {TICKER} | {reason}` and continue
- Network failure: print error line and continue — never abort the full fetch
- Rate limit: single retry after 200ms, then error line

## When to Call

At the start of every monitoring cycle, for all watchlist tickers in one invocation.
