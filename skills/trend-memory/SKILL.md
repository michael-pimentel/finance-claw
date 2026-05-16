---
name: trend-memory
description: >
  Save session notes and patterns to persistent memory.
  Triggers when: end of every heartbeat cycle, after an alert is sent,
  "remember this", "log this", "save this pattern", session winding down.
---

## How to Write to Memory

1. Call `read` on `MEMORY.md` to get the current contents
2. Append your new line(s) to the correct section (do not overwrite anything)
3. Call `write` to save the updated file back to `MEMORY.md`

## What to Write

**After every heartbeat — one summary line under `## Session Notes`:**
```
[2024-05-15 14:32 ET] Checked: NVDA TSLA AAPL SPY BTC-USD | Flagged: NVDA (+2.41%) | Alert: sent
[2024-05-15 14:42 ET] Checked: NVDA TSLA AAPL SPY BTC-USD | Flagged: none | Alert: none
```

**After an alert is sent — one entry under `## Alert History`:**
```
[2024-05-15 14:32 ET] NVDA +2.41% | Cause: GB300 chip announcement | Confidence: HIGH | Alert sent
```

**When a recurring pattern emerges — one line under `## Observed Patterns`:**
```
NVDA: spikes consistently on NVIDIA product announcement days — 3 occurrences this week
```
Only write a pattern entry when you have seen it at least twice. One entry per pattern per day.

## Rules

- Append only — never rewrite existing entries
- One line per event — MEMORY.md is injected every session and token cost matters
- Do not log raw page content or article text
- Always include: timestamp, ticker, move size, and disposition (Alert sent / Skipped / Error)
