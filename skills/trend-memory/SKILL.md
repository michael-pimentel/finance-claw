# Skill: trend-memory

Appends session summaries and observed patterns to MEMORY.md for cross-session learning.

## When to Use

After completing a cycle where at least one alert was sent OR an anomalous pattern was observed.

## What to Write

**Session summary line** (append to `## Session Notes` section):
```
[2024-05-15 14:32 ET] NVDA +4.2% — APAC partnership news. Alerted.
[2024-05-15 14:32 ET] TSLA -3.8% — No catalyst found. Anomalous move. Alerted.
```

**Pattern observation** (append to `## Observed Patterns` section, only when pattern is recurring):
```
NVDA: 3 alerts in 5 days — heightened volatility around earnings window.
```

## Format Rules

- One line per event, always include ticker, move, and disposition (Alerted / Skipped / Error)
- Timestamp in ET
- Do not rewrite existing entries — only append
- Maximum one pattern note per cycle to avoid bloat

## Implementation

The pipeline script (`scripts/run_pipeline.py`) handles writing to MEMORY.md directly.
This skill documents the contract; the writing logic lives in the pipeline.
