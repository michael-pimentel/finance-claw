# User Preferences

## Watchlist

```
NVDA, TSLA, AAPL, SPY, BTC-USD
```

Override with the `WATCHLIST` environment variable (comma-separated).

## Alert Thresholds

| Setting | Value |
|---|---|
| Default movement threshold | 2.0% |
| Minimum for no-news alert | 3.0% |
| Always-alert threshold | 5.0% |
| Deduplication window | 24 hours |

Override threshold with `MOVEMENT_THRESHOLD_PCT` environment variable.

## Alert Preferences

- **Channel**: Telegram (primary), log file fallback if not configured
- **Format**: Concise — ticker, % move, one-sentence explanation, relevant headline
- **Noise policy**: Aggressive filtering — only alert on material, explainable events or genuinely anomalous moves
- **Crypto**: Include BTC-USD in watchlist; treat the same as equities for threshold purposes

## Tone

Analyst-style, not broadcast-style. Short sentences. Facts first.

## Timezone

Market hours reference: **US Eastern Time (ET)**. Timestamps in alerts should be human-readable.

## Notes

- TSLA is high-volatility — apply threshold strictly; do not alert on sub-3% intraday swings
- SPY moves reflect macro conditions — when SPY is a mover, always check if individual names are following it or diverging
- BTC-USD trades 24/7 — the agent runs at all hours for crypto even when equity markets are closed
