# Sentinel Memory

## Persistent Alert Log

Alerts are stored in SQLite at `~/.openclaw/finance-claw/alerts.db`.
Each record: ticker, summary, change_pct, created_at.

## Session Notes

<!-- Sentinel appends one line per cycle here when something noteworthy happens -->
<!-- Format: [YYYY-MM-DD HH:MM ET] TICKER ±X.X% — one-line summary -->

## Observed Patterns

<!-- Sentinel writes here when it detects a recurring pattern across sessions -->
<!-- Example: NVDA tends to move on Wednesdays before options expiry -->

## User Overrides

<!-- Temporary overrides the user has communicated during a session -->
<!-- Example: "ignore TSLA alerts this week — I already have a position" -->
