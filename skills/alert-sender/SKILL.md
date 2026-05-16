# Skill: alert-sender

Sends a formatted alert to the configured channel (Telegram or log file fallback).

## Script

```
python scripts/send_telegram.py "NVDA +4.2% — NVIDIA expanded H100 partnerships in APAC. Likely catalyst."
```

Or via stdin:
```
echo "message" | python scripts/send_telegram.py
```

## Channels

| Channel | Config | Script |
|---|---|---|
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `scripts/send_telegram.py` |
| Slack | `SLACK_WEBHOOK_URL` | `scripts/send_slack.py` |
| Log file | Always available as fallback | writes to `alerts.log` |

## Alert Format

```
📊 Sentinel Alert: {TICKER}

{+/-}{change_pct}% — {summary}

📰 {headline}
🔗 {url}

{timestamp ET}
```

## Deduplication

The OpenClaw plugin's `check_recent_alerts` tool (SQLite-backed) handles deduplication.
The Python scripts do not deduplicate — they send what they're told.
Always call `check_recent_alerts` before calling this skill.

## Fallback Behavior

If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is not set:
- Write to `alerts.log` in the project root
- Print `[ALERT LOG] {message}` to stdout
- Exit 0 (not an error — this is expected in dev mode)
