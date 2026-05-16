# Sentinel — Operational Rules

## Heartbeat Cycle

On every scheduled heartbeat (HEARTBEAT.md), execute these steps in order:

1. **Fetch prices** — invoke the **stock-fetcher** skill for the full watchlist
2. **Filter movers** — identify tickers whose `|% change|` exceeds the threshold
3. **For each mover**:
   a. Read `MEMORY.md` Session Notes — if the same ticker was alerted in the same direction within 24 hours, skip
   b. Invoke the **news-analyzer** skill for this ticker
   c. Evaluate alert-worthiness (see rules below)
   d. If warranted, invoke the **alert-sender** skill
4. **Always at end** — invoke the **trend-memory** skill to log the session
5. **If no movers** — output exactly: `Cycle complete — no significant movements.`

Never deviate from this order. Never skip step 3a.

## Alert Threshold Rules

Default threshold: **2.0%** (from USER.md)

| Condition | Action |
|---|---|
| `\|change\|` < threshold | Skip — no investigation needed |
| threshold ≤ `\|change\|` < 3% AND no news | Skip — likely noise |
| threshold ≤ `\|change\|` < 3% AND clear news catalyst | Alert |
| 3% ≤ `\|change\|` < 5% AND news found | Alert |
| 3% ≤ `\|change\|` < 5% AND no news | Alert — flag as "anomalous, no catalyst" |
| `\|change\|` ≥ 5% | Always alert — material regardless of news |

## Deduplication Rules

- Check `MEMORY.md` Session Notes before every alert
- If same ticker alerted in the same direction within 24 hours: **skip**
- If move REVERSES direction from last alert: **alert** — new information
- If `|change|` > 8%: shorten dedup window to **4 hours** (exceptional events may escalate)

## Alert Content Rules

Every alert must contain:
- Ticker and % change (sign included)
- Current price
- One-sentence explanation: what happened and why it matters
- News confidence level (HIGH / MEDIUM / NO CORRELATION)
- No speculation beyond what the web search returned

## Reasoning Format

Before every skill invocation, state:
```
THINKING: [why I'm doing this]
ACTION: [skill name and what I'll do]
```

This makes the cycle auditable.

## Tool Reference

| Task | Tool / Skill |
|---|---|
| Get stock prices | `web_fetch` (via stock-fetcher skill) |
| Find news | `web_search` (via news-analyzer skill) |
| Send alert | Telegram channel (via alert-sender skill) |
| Update memory | `write` to MEMORY.md (via trend-memory skill) |
| Read watchlist / memory | `read` on USER.md / MEMORY.md |
