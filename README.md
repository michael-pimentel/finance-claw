# Sentinel — Autonomous Financial Monitoring Agent

Built for the **NVIDIA × OpenClaw Hackathon** using [NVIDIA Nemotron](https://build.nvidia.com) and the [OpenClaw](https://openclaw.dev) agent framework.

Sentinel watches your stock watchlist on a heartbeat, investigates significant price moves with live news, and sends formatted Telegram alerts — only when something genuinely material happens.

---

## How It Works

```
Heartbeat fires (every 5 min)
    ↓
fetch_prices(NVDA, TSLA, AAPL, SPY, BTC-USD)
    ↓
Filter: |change| ≥ threshold?
    ↓ YES                      ↓ NO
check_recent_alerts         "No significant movements."
    ↓ NOT alerted recently
fetch_news(ticker)
    ↓
Evaluate: price + news → material?
    ↓ YES
send_alert → Telegram
    ↓
Append to MEMORY.md
```

The agent explains its reasoning at every step (`THINKING: … ACTION: …`). Silence is the correct output when nothing is happening.

---

## Prerequisites

- **Python 3.11+**
- **Node.js 22+** (for the OpenClaw gateway)
- **pnpm** (activated via `corepack enable pnpm`)

---

## Setup

```bash
# 1. Clone and enter the project
cd finance-claw

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env — at minimum set NVIDIA_API_KEY and FINNHUB_API_KEY

# 3. Install Node dependencies (OpenClaw gateway)
pnpm install

# 4. Install Python dependencies
pip install -r requirements.txt
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | Yes (agent) | NVIDIA NIM API key from build.nvidia.com |
| `FINNHUB_API_KEY` | Yes | Finnhub free tier key — prices and news |
| `NEWSAPI_KEY` | No | newsapi.org or newsapi.ai key — fallback news |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | No | Your Telegram chat or channel ID |
| `SLACK_WEBHOOK_URL` | No | Slack Incoming Webhook URL |
| `WATCHLIST` | No | Comma-separated tickers (default: `NVDA,TSLA,AAPL,SPY,BTC-USD`) |
| `MOVEMENT_THRESHOLD_PCT` | No | Alert threshold in % (default: `2.0`) |

---

## Running

### Demo mode (hackathon presentation)

Shows the full pipeline with simulated NVDA +4.2% and TSLA -3.8% moves. Step-by-step traced output with color. Sends a real Telegram alert if configured.

```bash
python scripts/demo_run.py

# Skip the actual alert send:
python scripts/demo_run.py --no-alert
```

### Live pipeline (real market data)

Runs one full monitoring cycle against the actual Finnhub API.

```bash
python scripts/run_pipeline.py

# Dry run — no alerts sent:
python scripts/run_pipeline.py --dry-run
```

### Individual scripts

```bash
# Fetch prices
python scripts/fetch_prices.py NVDA TSLA AAPL SPY BTC-USD

# Fetch news for a ticker
python scripts/fetch_news.py NVDA
python scripts/fetch_news.py NVDA --hours 48

# Send a Telegram alert
python scripts/send_telegram.py "NVDA +4.2% — expanded H100 partnerships."

# Send a Slack alert
python scripts/send_slack.py "NVDA +4.2% — expanded H100 partnerships."
```

### Full OpenClaw agent (autonomous heartbeat)

Starts the gateway with Nemotron model. The agent runs the full cycle automatically every 5 minutes.

```bash
pnpm start       # Start gateway (foreground)
pnpm dashboard   # Open dashboard at http://127.0.0.1:18789
pnpm stop        # Stop the gateway
```

---

## Project Structure

```
finance-claw/
├── SOUL.md                    # Agent identity and personality
├── AGENTS.md                  # Operational rules and alert thresholds
├── USER.md                    # Watchlist and user preferences
├── MEMORY.md                  # Persistent cross-session memory
│
├── scripts/
│   ├── fetch_prices.py        # yfinance + Finnhub price fetcher
│   ├── fetch_news.py          # Yahoo RSS + NewsAPI news fetcher
│   ├── send_telegram.py       # Telegram alert sender
│   ├── send_slack.py          # Slack alert sender
│   ├── run_pipeline.py        # Full monitoring pipeline (standalone)
│   └── demo_run.py            # Hackathon demo mode
│
├── plugins/finance-tools/     # OpenClaw plugin (TypeScript)
│   └── src/
│       ├── stock.ts           # fetch_prices tool (Finnhub)
│       ├── news.ts            # fetch_news tool (Finnhub company news)
│       ├── alerts.ts          # send_alert tool (Telegram)
│       └── memory.ts          # check_recent_alerts (SQLite)
│
├── skills/                    # Skill definitions (OpenClaw workspace)
│   ├── stock-fetcher/SKILL.md
│   ├── news-analyzer/SKILL.md
│   ├── alert-sender/SKILL.md
│   └── trend-memory/SKILL.md
│
├── openclaw.json5             # OpenClaw agent config
├── package.json               # Node dependencies
└── requirements.txt           # Python dependencies
```

---

## Alert Format

```
📊 Sentinel Alert: NVDA

+4.21% — $891.34

NVDA up 4.21% — likely catalyst: NVIDIA Expands H100 Supply Agreements...

📰 NVIDIA Expands H100 Supply Agreements with Three Asia-Pacific Partners
🔗 https://reuters.com/...

2024-05-15 14:32 UTC
```

---

## Architecture Notes

- **Deduplication**: SQLite at `~/.openclaw/finance-claw/alerts.db` — no duplicate alerts within 24h window
- **Noise filtering**: Sub-threshold and no-news sub-3% moves are silently skipped
- **Graceful degradation**: If any data source fails, the pipeline continues with remaining tickers
- **No paid APIs required**: yfinance and Yahoo Finance RSS are free; Finnhub free tier covers the watchlist; all paid sources are optional fallbacks
