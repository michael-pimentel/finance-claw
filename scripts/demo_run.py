#!/usr/bin/env python3
"""
demo_run.py — Hackathon demo mode for Sentinel.

Simulates a real monitoring cycle with injected price spikes:
  - NVDA  +4.2%  (positive catalyst)
  - TSLA  -3.8%  (negative move)

Shows the full agent reasoning pipeline step by step.
Sends a real Telegram alert if configured, otherwise logs to file.

Usage:
    python scripts/demo_run.py
    python scripts/demo_run.py --no-alert   # show pipeline only, skip send
"""

import sys
import os
import argparse
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"
SCRIPTS = ROOT / "scripts"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = val

load_env(ENV_FILE)

# ANSI colors
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"


def banner(text: str) -> None:
    width = 64
    print()
    print(f"{BOLD}{'═' * width}{RESET}")
    print(f"{BOLD}  {text}{RESET}")
    print(f"{BOLD}{'═' * width}{RESET}")
    print()


def step(n: int, total: int, label: str) -> None:
    print(f"{CYAN}{BOLD}[ Step {n}/{total} ]{RESET} {label}")


def thinking(text: str) -> None:
    print(f"  {DIM}THINKING:{RESET} {text}")


def action(text: str) -> None:
    print(f"  {BOLD}ACTION:{RESET} {text}")


def result_ok(text: str) -> None:
    print(f"  {GREEN}✓{RESET} {text}")


def result_warn(text: str) -> None:
    print(f"  {YELLOW}⚠{RESET} {text}")


def decision_alert(text: str) -> None:
    print(f"  {GREEN}{BOLD}→ ALERT{RESET}: {text}")


def decision_skip(text: str) -> None:
    print(f"  {DIM}→ SKIP{RESET}: {text}")


def pause(ms: int = 300) -> None:
    time.sleep(ms / 1000)


# ---------------------------------------------------------------------------
# Simulated data
# ---------------------------------------------------------------------------

DEMO_PRICES = [
    {"ticker": "NVDA",    "price": 891.34,  "change_pct": +4.21, "volume": 52_410_300},
    {"ticker": "TSLA",    "price": 164.72,  "change_pct": -3.78, "volume": 98_234_100},
    {"ticker": "AAPL",    "price": 189.45,  "change_pct": +0.43, "volume": 41_002_700},
    {"ticker": "SPY",     "price": 527.81,  "change_pct": +0.12, "volume": 62_819_400},
    {"ticker": "BTC-USD", "price": 67_240.0,"change_pct": -0.89, "volume": 0},
]

DEMO_NEWS = {
    "NVDA": [
        {
            "title": "NVIDIA Expands H100 Supply Agreements with Three Asia-Pacific Partners",
            "source": "Reuters",
            "published_at": "2024-05-15 13:45 ET",
            "url": "https://reuters.com/example/nvda-h100-apac",
            "description": "NVIDIA announced expanded supply agreements with Foxconn, Pegatron, and Quanta "
                           "to produce additional H100 GPU modules for enterprise AI deployments across the region.",
        },
        {
            "title": "Analysts Raise NVDA Price Targets Following AI Demand Outlook",
            "source": "Bloomberg",
            "published_at": "2024-05-15 12:20 ET",
            "url": "https://bloomberg.com/example/nvda-pt-raise",
            "description": "Three major banks raised their 12-month price targets for NVIDIA citing "
                           "accelerating demand for AI training infrastructure.",
        },
    ],
    "TSLA": [
        {
            "title": "Tesla Delays Robotaxi Unveil Amid Software Readiness Concerns",
            "source": "Wall Street Journal",
            "published_at": "2024-05-15 11:05 ET",
            "url": "https://wsj.com/example/tsla-robotaxi-delay",
            "description": "Tesla has pushed back the planned robotaxi reveal event by two months, "
                           "citing ongoing software validation challenges, sources familiar with the matter said.",
        },
    ],
}

DEMO_THRESHOLD = 2.0


# ---------------------------------------------------------------------------
# Demo pipeline
# ---------------------------------------------------------------------------

def run_demo(no_alert: bool = False) -> None:
    banner("SENTINEL — Autonomous Financial Monitoring Agent")
    print(f"  {BOLD}DEMO MODE{RESET} — Simulated market data with injected price moves")
    print(f"  Model    : NVIDIA Nemotron-3 Super 120B")
    print(f"  Watchlist: NVDA, TSLA, AAPL, SPY, BTC-USD")
    print(f"  Threshold: ±{DEMO_THRESHOLD}%")
    print(f"  Time     : {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

    # ── Step 1: Prices ──────────────────────────────────────────────────────
    step(1, 5, "Fetching current prices for all watchlist tickers")
    thinking("Calling fetch_prices for the full watchlist in a single batch request.")
    action("fetch_prices([NVDA, TSLA, AAPL, SPY, BTC-USD])")
    pause(600)

    print()
    for r in DEMO_PRICES:
        ticker = r["ticker"]
        price = r["price"]
        chg = r["change_pct"]
        vol = f"{r['volume']:,}" if r["volume"] else "N/A"
        sign = "+" if chg >= 0 else ""
        color = GREEN if chg > 0 else (RED if chg < 0 else RESET)
        print(f"  {ticker:8s}  ${price:>10,.2f}  {color}{sign}{chg:.2f}%{RESET}  vol:{vol}")

    # ── Step 2: Filter movers ────────────────────────────────────────────────
    print()
    step(2, 5, f"Identifying movers above ±{DEMO_THRESHOLD}% threshold")

    movers = [r for r in DEMO_PRICES if abs(r["change_pct"]) >= DEMO_THRESHOLD]
    non_movers = [r for r in DEMO_PRICES if abs(r["change_pct"]) < DEMO_THRESHOLD]

    for r in non_movers:
        decision_skip(f"{r['ticker']} {r['change_pct']:+.2f}% — below threshold, no investigation needed")

    for r in movers:
        color = GREEN if r["change_pct"] > 0 else RED
        print(f"  {color}{BOLD}⚡ MOVER{RESET}: {r['ticker']} {r['change_pct']:+.2f}% — qualifies for investigation")

    # ── Step 3: Investigate each mover ──────────────────────────────────────
    print()
    step(3, 5, f"Investigating {len(movers)} mover(s)")

    alerts_to_send = []

    for mover in movers:
        ticker = mover["ticker"]
        chg = mover["change_pct"]
        price = mover["price"]
        color = GREEN if chg > 0 else RED
        direction = "up" if chg > 0 else "down"

        print()
        print(f"  {BOLD}── {ticker} {color}{chg:+.2f}%{RESET} ──────────────────────────")
        pause(300)

        # Deduplication check
        thinking(f"{ticker} crossed ±{DEMO_THRESHOLD}% threshold. Checking deduplication window (24h).")
        action(f"check_recent_alerts(ticker={ticker}, hours=24)")
        pause(400)
        result_ok(f"No recent alert for {ticker} in the last 24h — proceeding.")

        # News fetch
        thinking(f"Fetching news for {ticker} to determine if there is a causal explanation.")
        action(f"fetch_news(query='{ticker}', hours_back=24)")
        pause(700)

        articles = DEMO_NEWS.get(ticker, [])
        if articles:
            result_ok(f"Found {len(articles)} article(s):")
            for a in articles:
                print(f"    📰 {a['title']}")
                print(f"       {DIM}{a['source']} · {a['published_at']}{RESET}")
        else:
            result_warn(f"No news found for {ticker}.")

        # Reasoning
        pause(500)
        print()
        thinking(
            f"Price moved {chg:+.2f}% ({direction}). "
            + (f"News present — evaluating whether headline is a plausible catalyst." if articles else
               f"No news found — this qualifies as an anomalous move.")
        )
        pause(400)

        # Decision
        if abs(chg) >= 3.0 and articles:
            top = articles[0]
            summary = f"{ticker} {chg:+.2f}% — likely catalyst: {top['title'][:60]}..."
            decision_alert(summary)
            alerts_to_send.append({
                "ticker": ticker,
                "change_pct": chg,
                "price": price,
                "summary": summary,
                "headline": top["title"],
                "url": top["url"],
            })
        elif abs(chg) >= 3.0 and not articles:
            summary = f"{ticker} {chg:+.2f}% with no news catalyst — anomalous move, flagging for attention."
            decision_alert(summary)
            alerts_to_send.append({
                "ticker": ticker,
                "change_pct": chg,
                "price": price,
                "summary": summary,
                "headline": None,
                "url": None,
            })
        else:
            decision_skip(f"{ticker} — sub-3% with news, not material enough")

    # ── Step 4: Send alerts ──────────────────────────────────────────────────
    print()
    step(4, 5, f"Sending {len(alerts_to_send)} alert(s)")

    for a in alerts_to_send:
        ticker = a["ticker"]
        chg = a["change_pct"]
        price = a["price"]
        sign = "+" if chg >= 0 else ""
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        msg_lines = [
            f"📊 <b>Sentinel Alert: {ticker}</b>",
            f"<b>{sign}{chg:.2f}%</b> — ${price:,.2f}",
            "",
            a["summary"],
        ]
        if a.get("headline"):
            msg_lines += ["", f"📰 <i>{a['headline']}</i>"]
        if a.get("url"):
            msg_lines.append(f"🔗 {a['url']}")
        msg_lines += ["", f"<i>{ts}</i>"]
        message = "\n".join(msg_lines)

        print(f"  {BOLD}Alert message for {ticker}:{RESET}")
        for line in msg_lines:
            print(f"  {DIM}│{RESET} {line}")
        print()

        if no_alert:
            result_warn("--no-alert flag set — skipping send.")
        else:
            action("send_alert(...)")
            pause(300)
            subprocess.run(
                [sys.executable, str(SCRIPTS / "send_telegram.py"), message],
                timeout=15
            )

    # ── Step 5: Memory ───────────────────────────────────────────────────────
    print()
    step(5, 5, "Updating MEMORY.md with session summary")
    pause(300)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    for a in alerts_to_send:
        entry = f"[{ts}] {a['ticker']} {a['change_pct']:+.2f}% — {a['summary']} Alerted. (DEMO)"
        print(f"  {DIM}→{RESET} {entry}")
    result_ok("Memory updated.")

    # ── Summary ──────────────────────────────────────────────────────────────
    banner("Demo Complete")
    print(f"  Tickers checked  : {len(DEMO_PRICES)}")
    print(f"  Movers detected  : {len(movers)}")
    print(f"  Alerts sent      : {len(alerts_to_send)}" + (" (dry run)" if no_alert else ""))
    print()
    print(f"  {DIM}To run against real market data:{RESET}")
    print(f"    python scripts/run_pipeline.py")
    print()
    print(f"  {DIM}To start the full OpenClaw agent:{RESET}")
    print(f"    pnpm start")
    print(f"    pnpm dashboard   # open http://127.0.0.1:18789")
    print()


def main():
    parser = argparse.ArgumentParser(description="Sentinel hackathon demo")
    parser.add_argument("--no-alert", action="store_true", help="Show pipeline without sending alerts")
    args = parser.parse_args()
    run_demo(no_alert=args.no_alert)


if __name__ == "__main__":
    main()
