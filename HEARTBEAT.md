# HEARTBEAT

You have been woken by the scheduled heartbeat. Run the monitoring cycle now.

1. Check `USER.md` for allowed hours — if outside the window, output `Outside trading hours — skipping cycle.` and stop
2. Run the **stock-fetcher** skill — fetch prices for all tickers in `USER.md`
3. Identify tickers above their threshold
4. For each flagged ticker: run the **news-analyzer** skill
5. For each ticker where confidence is HIGH or MEDIUM (or move ≥ 5%): run the **alert-sender** skill
6. Always: run the **trend-memory** skill to log this session to `MEMORY.md`

Be concise. Show reasoning. One cycle, then done.
