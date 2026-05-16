---
name: news-analyzer
description: >
  Find and evaluate financial news for a flagged ticker.
  Triggers when: a ticker is flagged by stock-fetcher, "why is X moving",
  "news on NVDA", "what happened to TSLA", investigating a price move,
  after any ticker crosses its alert threshold.
---

## How to Find News

For each flagged ticker:

1. Call `web_search` with the query: `{TICKER} {COMPANY_NAME} stock news today`
   - Example: `NVDA NVIDIA stock news today`
   - Example: `TSLA Tesla stock news today`
   - Example: `BTC-USD Bitcoin stock news today`

2. Read the top 3–5 results. For each result assess:
   - **Relevance** — is this actually about this company or its direct sector? (High / Med / Low)
   - **Sentiment** — does the direction of the news match the price move direction?
   - **Timing** — was it published in the last 24 hours? Does it precede the move?

3. If the snippets are insufficient, call `web_fetch` on the URL of the most relevant result to read the full article.

## Synthesize

Write 1–2 sentences connecting the news to the price move. Be explicit:
> "NVIDIA announced the GB300 chip lineup 2 hours before the spike. The product launch likely triggered institutional buying."

If nothing correlates:
> "No news found matching the timing or direction of this move."

## Confidence Rating

| Rating | Criteria |
|---|---|
| **HIGH** | Clear news catalyst, published before the move, direction matches |
| **MEDIUM** | Relevant news but timing is loose or the link is indirect |
| **LOW** | Tangential news or different sector |
| **NO CORRELATION** | No relevant news found |

## Output Format

```
NEWS CORRELATION — NVDA (+2.41%)
• "NVIDIA announces GB300 chip lineup" (Reuters, 2h ago) — Positive, High relevance
• "Chip sector rallies on trade optimism" (Bloomberg, 4h ago) — Positive, Med relevance
→ Likely cause: Product launch + sector tailwind
→ Confidence: HIGH
```

## Decision Gate

- **HIGH or MEDIUM** → invoke **alert-sender** skill
- **LOW or NO CORRELATION** and `|change| < 5%` → skip alert, log in session summary
- **LOW or NO CORRELATION** and `|change| ≥ 5%` → alert anyway, flag as anomalous move
