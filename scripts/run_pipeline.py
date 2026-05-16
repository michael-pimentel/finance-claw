#!/usr/bin/env python3
"""
run_pipeline.py — Full Sentinel monitoring pipeline.

Runs one complete heartbeat cycle:
  1. Load watchlist
  2. Fetch prices for all tickers
  3. Identify movers above threshold
  4. For each mover: fetch news, evaluate, send alert if warranted
  5. Append session summary to MEMORY.md

Usage:
    python scripts/run_pipeline.py
    python scripts/run_pipeline.py --dry-run   # no alerts sent
"""

import sys
import os
import argparse
import subprocess
import re
from datetime import datetime, timezone
from pathlib import Path

# Load .env from project root
ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"

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

SCRIPTS = ROOT / "scripts"


# ---------------------------------------------------------------------------
# Watchlist
# ---------------------------------------------------------------------------

def get_watchlist() -> list[str]:
    env = os.environ.get("WATCHLIST", "")
    if env:
        return [t.strip().upper() for t in env.split(",") if t.strip()]
    # Parse from USER.md as fallback
    user_md = ROOT / "USER.md"
    if user_md.exists():
        content = user_md.read_text()
        m = re.search(r"```\s*([\w,\s\-]+)\s*```", content)
        if m:
            return [t.strip().upper() for t in m.group(1).split(",") if t.strip()]
    return ["NVDA", "TSLA", "AAPL", "SPY", "BTC-USD"]


# ---------------------------------------------------------------------------
# Price fetching
# ---------------------------------------------------------------------------

def parse_price_line(line: str) -> dict | None:
    """Parse: TICKER | price | change_pct% | volume | timestamp"""
    if line.startswith("ERROR:"):
        parts = line[6:].split("|", 1)
        return {"ticker": parts[0].strip(), "error": parts[1].strip() if len(parts) > 1 else "unknown"}
    parts = [p.strip() for p in line.split("|")]
    if len(parts) < 4:
        return None
    try:
        change_str = parts[2].rstrip("%")
        return {
            "ticker": parts[0],
            "price": float(parts[1]),
            "change_pct": float(change_str),
            "volume": int(parts[3]) if parts[3].isdigit() else 0,
            "timestamp": parts[4] if len(parts) > 4 else "",
        }
    except ValueError:
        return None


def fetch_prices(tickers: list[str]) -> list[dict]:
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "fetch_prices.py")] + tickers,
        capture_output=True, text=True, timeout=30
    )
    rows = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        parsed = parse_price_line(line)
        if parsed:
            rows.append(parsed)
        else:
            print(f"  [WARN] Could not parse price line: {line}", file=sys.stderr)
    return rows


# ---------------------------------------------------------------------------
# News fetching
# ---------------------------------------------------------------------------

def parse_news_output(output: str) -> list[dict]:
    if output.strip().startswith("NO_NEWS"):
        return []
    articles = []
    current: dict = {}
    for line in output.splitlines():
        m = re.match(r"\[(\d+)\] Title: (.+)", line)
        if m:
            if current:
                articles.append(current)
            current = {"title": m.group(2).strip()}
        elif line.strip().startswith("Source:") and current:
            parts = line.strip()[7:].split("|")
            current["source"] = parts[0].strip()
            if len(parts) > 1:
                current["published_at"] = parts[1].replace("Published:", "").strip()
        elif line.strip().startswith("URL:") and current:
            current["url"] = line.strip()[4:].strip()
        elif line.strip().startswith("Summary:") and current:
            current["description"] = line.strip()[8:].strip()
    if current:
        articles.append(current)
    return articles


def fetch_news(ticker: str, hours_back: int = 24) -> list[dict]:
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "fetch_news.py"), ticker, "--hours", str(hours_back)],
        capture_output=True, text=True, timeout=20
    )
    return parse_news_output(result.stdout)


# ---------------------------------------------------------------------------
# Alert sending
# ---------------------------------------------------------------------------

def send_alert(message: str, dry_run: bool) -> None:
    if dry_run:
        print(f"  [DRY RUN] Would send alert: {message}")
        return
    subprocess.run(
        [sys.executable, str(SCRIPTS / "send_telegram.py"), message],
        timeout=15
    )


def format_alert_message(ticker: str, change_pct: float, price: float,
                          summary: str, headline: str | None = None,
                          url: str | None = None) -> str:
    sign = "+" if change_pct >= 0 else ""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"📊 <b>Sentinel Alert: {ticker}</b>",
        f"<b>{sign}{change_pct:.2f}%</b> — ${price:.2f}",
        "",
        summary,
    ]
    if headline:
        lines += ["", f"📰 <i>{headline}</i>"]
    if url:
        lines.append(f"🔗 {url}")
    lines += ["", f"<i>{ts}</i>"]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# MEMORY.md append
# ---------------------------------------------------------------------------

def append_memory(entries: list[str]) -> None:
    memory_path = ROOT / "MEMORY.md"
    if not entries or not memory_path.exists():
        return
    content = memory_path.read_text()
    marker = "## Session Notes"
    if marker not in content:
        return
    insert_after = content.index(marker) + len(marker)
    # Find the next blank line after the marker
    rest = content[insert_after:]
    newlines = "\n".join(f"<!-- {e} -->" for e in entries)
    updated = content[:insert_after] + "\n" + newlines + rest
    memory_path.write_text(updated)


# ---------------------------------------------------------------------------
# Alert-worthiness evaluation
# ---------------------------------------------------------------------------

def evaluate_alert(ticker: str, change_pct: float, articles: list[dict],
                   threshold: float) -> tuple[bool, str, str | None, str | None]:
    """Returns (should_alert, summary, headline, url)."""
    abs_change = abs(change_pct)
    direction = "up" if change_pct > 0 else "down"
    has_news = len(articles) > 0

    top = articles[0] if articles else None
    headline = top["title"] if top else None
    url = top.get("url") if top else None

    if abs_change >= 5.0:
        if has_news:
            summary = f"{ticker} moved {change_pct:+.2f}% — likely catalyst: see headline."
        else:
            summary = f"{ticker} moved {change_pct:+.2f}% with no apparent news catalyst — anomalous move."
        return True, summary, headline, url

    if abs_change >= 3.0:
        if has_news:
            summary = f"{ticker} {direction} {abs_change:.2f}% — news present, may be material."
        else:
            summary = f"{ticker} {direction} {abs_change:.2f}% — no catalyst identified. Anomalous."
        return True, summary, headline, url

    # threshold ≤ change < 3%
    if has_news:
        summary = f"{ticker} {direction} {abs_change:.2f}% with news activity — monitoring."
        return True, summary, headline, url

    return False, "", None, None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run(dry_run: bool = False) -> None:
    threshold = float(os.environ.get("MOVEMENT_THRESHOLD_PCT", "2.0"))
    watchlist = get_watchlist()

    print("=" * 60)
    print(f"  Sentinel Monitoring Cycle — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)
    print(f"  Watchlist : {', '.join(watchlist)}")
    print(f"  Threshold : ±{threshold}%")
    if dry_run:
        print("  Mode      : DRY RUN (no alerts will be sent)")
    print()

    # Step 1: Fetch prices
    print("[ 1 / 4 ] Fetching prices...")
    price_data = fetch_prices(watchlist)

    if not price_data:
        print("  ERROR: No price data returned. Aborting cycle.")
        return

    for row in price_data:
        if "error" in row:
            print(f"  ERROR: {row['ticker']} — {row['error']}")
        else:
            sign = "+" if row["change_pct"] >= 0 else ""
            print(f"  {row['ticker']:8s} ${row['price']:>9.2f}  {sign}{row['change_pct']:.2f}%")

    # Step 2: Find movers
    movers = [r for r in price_data if "error" not in r and abs(r["change_pct"]) >= threshold]
    print()

    if not movers:
        print(f"[ 2 / 4 ] No movers ≥ {threshold}% — cycle complete, no alerts needed.")
        print()
        print("Cycle complete — no significant movements.")
        return

    print(f"[ 2 / 4 ] Movers (≥{threshold}%): {', '.join(m['ticker'] for m in movers)}")
    print()

    # Step 3: Investigate movers
    memory_entries = []
    alerted = 0

    for mover in movers:
        ticker = mover["ticker"]
        change_pct = mover["change_pct"]
        price = mover["price"]
        print(f"[ 3 / 4 ] Investigating {ticker} ({change_pct:+.2f}%)...")

        print(f"  THINKING: {ticker} crossed threshold. Checking for recent alerts first.")
        # (Deduplication is handled by the OpenClaw plugin when running via the agent.
        #  In standalone pipeline mode we skip it to keep this script dependency-free.)

        print(f"  ACTION: fetch_news({ticker})")
        articles = fetch_news(ticker)

        if articles:
            print(f"  Found {len(articles)} article(s):")
            for a in articles[:3]:
                print(f"    • {a['title']}")
        else:
            print(f"  No news found for {ticker}.")

        should_alert, summary, headline, url = evaluate_alert(ticker, change_pct, articles, threshold)

        if should_alert:
            print(f"  DECISION: ALERT — {summary}")
            message = format_alert_message(ticker, change_pct, price, summary, headline, url)
            send_alert(message, dry_run)
            alerted += 1
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            memory_entries.append(f"[{ts}] {ticker} {change_pct:+.2f}% — {summary} Alerted.")
        else:
            print(f"  DECISION: SKIP — move is sub-threshold or noise ({change_pct:+.2f}%, no news)")
            memory_entries.append(
                f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}] "
                f"{ticker} {change_pct:+.2f}% — below alert criteria. Skipped."
            )
        print()

    # Step 4: Write to MEMORY.md
    print("[ 4 / 4 ] Updating MEMORY.md...")
    append_memory(memory_entries)

    print()
    print(f"Cycle complete — {alerted} alert(s) sent, {len(movers) - alerted} skipped.")


def main():
    parser = argparse.ArgumentParser(description="Sentinel monitoring pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Run without sending alerts")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
