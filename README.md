# FinanceClaw

Autonomous stock-monitoring agent built on OpenClaw. Watches a watchlist of tickers on a heartbeat, investigates significant price moves with news, and sends Telegram alerts when something material happens.

## Prerequisites

- Node.js 22+
- pnpm
- Finnhub API key
- NVIDIA API key (for the Nemotron model)

## Setup

```bash
cp .env.example .env   # or edit .env directly
pnpm install
```

Required `.env` values:

| Variable | Description |
|---|---|
| `NVIDIA_API_KEY` | NVIDIA NIM API key |
| `FINNHUB_API_KEY` | Finnhub market data key |
| `WATCHLIST` | Comma-separated tickers (e.g. `NVDA,MSFT,AAPL`) |
| `MOVEMENT_THRESHOLD_PCT` | Alert threshold in % (default `2.0`) |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token (pick any string) |

## Commands

```bash
pnpm start      # Load .env and start the OpenClaw gateway (foreground)
pnpm dashboard  # Open the agent dashboard in your browser
pnpm stop       # Stop the running gateway
```

### Manual test scripts

```bash
pnpm test:cycle   # Run one full monitoring cycle (no agent, no Telegram)
```

## Architecture

```
finance-claw/
├── plugins/finance-tools/   # OpenClaw plugin: tools exposed to the agent
│   └── src/
│       ├── stock.ts         # fetch_prices tool (Finnhub)
│       ├── news.ts          # fetch_news tool (stub, Step 5)
│       ├── alerts.ts        # send_alert tool (Telegram)
│       └── memory.ts        # check_recent_alerts, watchlist (SQLite)
├── scripts/
│   └── test-cycle.ts        # End-to-end cycle test without agent
└── openclaw.json5           # Project-level agent config (model, system prompt)
```

## Dashboard

After `pnpm start`, open: `http://127.0.0.1:18789/?token=<OPENCLAW_GATEWAY_TOKEN>`

The dashboard lets you chat with the agent directly, inspect tool calls, and monitor cron jobs.
