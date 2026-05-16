# Sentinel — Autonomous Financial Monitoring Agent

Built for the **NVIDIA × OpenClaw Hackathon** using [NVIDIA Nemotron](https://build.nvidia.com) and the [OpenClaw](https://openclaw.dev) agent framework.

**No Python. No app server. No scripts.** Nemotron is the application. It fetches live data using `web_fetch`, finds news using `web_search`, sends alerts through OpenClaw's native Telegram channel, and writes memory to `MEMORY.md` using the `write` tool — all directed by skill instruction files.

---

## How It Works

```
Heartbeat fires (every 10 min)
  └─> Nemotron reads SOUL.md + AGENTS.md + MEMORY.md + HEARTBEAT.md
  └─> stock-fetcher skill: web_fetch Yahoo Finance for each ticker
  └─> Nemotron compares prices to threshold
  └─> news-analyzer skill: web_search "{TICKER} stock news today"
  └─> Nemotron reasons: move + news → material?
  └─> alert-sender skill: send via Telegram channel (native)
  └─> trend-memory skill: write session summary to MEMORY.md
  └─> done, sleep until next heartbeat
```

The skills are markdown instruction files. They tell Nemotron *how* to use OpenClaw's built-in tools for financial monitoring — no custom code.

---

## Prerequisites

- **Node.js 22+**
- **OpenClaw** installed: `npm install -g openclaw@latest`
- An NVIDIA NIM account (free tier at [build.nvidia.com](https://build.nvidia.com))
- A Telegram bot (create via @BotFather) — optional but recommended

---

## Setup

```bash
# 1. Enter the project
cd finance-claw

# 2. Install Node dependencies
pnpm install   # or: corepack enable pnpm && pnpm install

# 3. Copy and fill in environment variables
cp .env.example .env
# Required: NVIDIA_API_KEY
# Recommended: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
```

---

## Running

### First launch — Sentinel introduces itself

```bash
pnpm start
```

Sentinel will read `BOOTSTRAP.md`, confirm your watchlist, check Telegram is configured, and tell you it's active.

### Dashboard

```bash
pnpm dashboard
# Opens: http://127.0.0.1:18789/?token=finance-claw-dev-token
```

### Register the heartbeat cron job

```bash
openclaw cron add \
  --name "sentinel-heartbeat" \
  --cron "*/10 * * * *" \
  --session isolated \
  --message "$(cat HEARTBEAT.md)"
```

After this, Sentinel checks the market every 10 minutes automatically.

### Stop

```bash
pnpm stop
```

---

## Live Demo for Judges

Send Sentinel this message in the dashboard or via Telegram:

> "Simulate: NVDA just moved +4.2% in the last 30 minutes. Run your full monitoring pipeline."

This triggers the full skill chain live — stock-fetcher → news-analyzer → alert-sender → trend-memory — without waiting for a real market move.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | Yes | NVIDIA NIM key from build.nvidia.com |
| `TELEGRAM_BOT_TOKEN` | Recommended | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Recommended | Your Telegram chat ID |
| `BRAVE_API_KEY` | No | Better web search (DuckDuckGo used if absent) |
| `WATCHLIST` | No | Tickers to watch (default: `NVDA,TSLA,AAPL,SPY,BTC-USD`) |
| `MOVEMENT_THRESHOLD_PCT` | No | Alert threshold in % (default: `2.0`) |

---

## Project Structure

```
finance-claw/
├── SOUL.md          # Agent identity and voice
├── AGENTS.md        # Operational rules and alert logic
├── USER.md          # Watchlist and user preferences
├── MEMORY.md        # Persistent cross-session memory
├── HEARTBEAT.md     # Instructions injected on every scheduled run
├── BOOTSTRAP.md     # Instructions injected on first conversation
│
├── skills/
│   ├── stock-fetcher/SKILL.md    # How to use web_fetch for prices
│   ├── news-analyzer/SKILL.md    # How to use web_search for news
│   ├── alert-sender/SKILL.md     # How to format and send Telegram alerts
│   └── trend-memory/SKILL.md     # How to write session notes to MEMORY.md
│
├── plugins/finance-tools/        # TypeScript plugin (fetch_prices, fetch_news, send_alert tools)
│
├── openclaw.json5                # OpenClaw agent config
└── package.json
```

---

## Alert Format

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

---

## NemoClaw (Bonus Track)

Deploy in a policy-enforced sandbox with audit logging:

```bash
nemoclaw onboard
# Select Nemotron when prompted
# Sentinel runs inside a NemoClaw sandbox with full audit trail
```
