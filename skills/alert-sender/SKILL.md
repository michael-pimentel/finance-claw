---
name: alert-sender
description: >
  Send a formatted market alert to the user via Telegram.
  Triggers when: news confidence is HIGH or MEDIUM, price move ≥ 5% regardless of news,
  "send alert", "notify the user", "alert me about".
  Do NOT trigger for sub-threshold moves or LOW/NO CORRELATION confidence.
---

## Pre-Send Checklist

Verify all of these before sending. If any check fails, skip the alert and log the reason.

- [ ] `|% change|` exceeds the ticker's threshold (from `USER.md`)
- [ ] News confidence is HIGH or MEDIUM (or `|change| ≥ 5%`)
- [ ] `MEMORY.md` Alert History does not contain this ticker in the same direction within the last 24 hours

## Alert Format

Compose the message in this exact structure:

```
🚨 SENTINEL ALERT
━━━━━━━━━━━━━━━━
Ticker:   NVDA
Move:     +2.41%  ($892 → $913)
Time:     2:34 PM ET

Why it matters:
NVIDIA announced the GB300 chip 2h ago. Sector also up on
trade optimism. Combined signal — high confidence move.

Confidence: HIGH
━━━━━━━━━━━━━━━━
```

Keep "Why it matters" to 3 sentences maximum. No speculation beyond what the search results showed.

## How to Send

Send the composed message via the Telegram channel. OpenClaw delivers it natively — no script, no HTTP call, just send the message through the channel.

## After Sending

Immediately invoke the **trend-memory** skill to record this alert in `MEMORY.md`.
