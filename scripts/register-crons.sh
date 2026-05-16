#!/usr/bin/env bash
# register-crons.sh — registers all FinanceClaw cron jobs against the running gateway.
# Run AFTER `pnpm start` has the gateway up: pnpm cron:register
#
# Jobs registered:
#   heartbeat      — every 5 minutes, main monitoring cycle
#   daily-briefing — weekdays at 4:30 PM ET, end-of-day market report

set -e

OPENCLAW="npx openclaw"
TOKEN="finance-claw-dev-token"
HOST="http://127.0.0.1:18789"

echo "=== FinanceClaw cron registration ==="
echo "Gateway: $HOST"
echo ""

# Verify gateway is up before trying to register
if ! curl -sf -H "Authorization: Bearer $TOKEN" "$HOST/health" > /dev/null 2>&1; then
  echo "ERROR: Gateway not reachable at $HOST"
  echo "Start the gateway first with: pnpm start"
  exit 1
fi

echo "Gateway is up. Registering jobs..."
echo ""

# --- Job 1: heartbeat (every 5 minutes) ---
echo "[1/2] Registering heartbeat (every 5 min)..."
$OPENCLAW cron add \
  --name "heartbeat" \
  --every "5m" \
  --message "Run a heartbeat monitoring cycle. Check all watchlist tickers for significant moves. If any ticker moved more than 3%, spawn a research sub-agent and send a Telegram alert. If markets are quiet, log 'markets quiet' and end." \
  --session isolated \
  --announce \
  --channel telegram \
  --host "$HOST" \
  --token "$TOKEN" 2>&1 && echo "  ✓ heartbeat registered" || echo "  ! heartbeat may already exist (run: pnpm cron:list)"

echo ""

# --- Job 2: daily briefing (weekdays 4:30 PM ET) ---
echo "[2/2] Registering daily-briefing (Mon–Fri 4:30 PM ET)..."
$OPENCLAW cron add \
  --name "daily-briefing" \
  --cron "30 16 * * 1-5" \
  --tz "America/New_York" \
  --message "Write today's end-of-day market briefing. Check prices for the full watchlist. Fetch sector performance for broad_market, semiconductors, and software. Search the web for top market stories today. Identify the top 3 stories of the day — what moved, why, and what to watch tomorrow. Format it as a DAILY BRIEFING with clear sections. Send the complete briefing via send_alert to Telegram." \
  --session isolated \
  --announce \
  --channel telegram \
  --host "$HOST" \
  --token "$TOKEN" 2>&1 && echo "  ✓ daily-briefing registered" || echo "  ! daily-briefing may already exist (run: pnpm cron:list)"

echo ""
echo "=== Done. Verify with: pnpm cron:list ==="
