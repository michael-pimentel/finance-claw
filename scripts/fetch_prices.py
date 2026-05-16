#!/usr/bin/env python3
"""
fetch_prices.py — Fetch current stock prices for one or more tickers.

Usage:
    python scripts/fetch_prices.py NVDA TSLA AAPL SPY BTC-USD

Output (one line per ticker):
    TICKER | price | change_pct% | volume | timestamp

Errors print as:
    ERROR: TICKER | reason
"""

import sys
import os
import time
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Primary: yfinance
# ---------------------------------------------------------------------------

def fetch_via_yfinance(tickers: list[str]) -> dict[str, dict]:
    import yfinance as yf

    results = {}
    data = yf.download(
        tickers=tickers,
        period="2d",
        interval="1d",
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    for ticker in tickers:
        try:
            if len(tickers) == 1:
                df = data
            else:
                df = data[ticker]

            if df.empty or len(df) < 1:
                results[ticker] = {"error": "no data returned"}
                continue

            latest = df.iloc[-1]
            prev = df.iloc[-2] if len(df) >= 2 else None

            import math
            price = float(latest["Close"])
            if math.isnan(price):
                results[ticker] = {"error": "no price data (NaN)"}
                continue
            volume = int(latest["Volume"]) if not math.isnan(latest["Volume"]) else 0

            if prev is not None:
                prev_close = float(prev["Close"])
                change_pct = ((price - prev_close) / prev_close) * 100 if prev_close else 0.0
            else:
                change_pct = 0.0

            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            results[ticker] = {
                "price": price,
                "change_pct": change_pct,
                "volume": volume,
                "timestamp": ts,
            }
        except Exception as e:
            results[ticker] = {"error": str(e)}

    return results


# ---------------------------------------------------------------------------
# Fallback: Finnhub REST API
# ---------------------------------------------------------------------------

def fetch_via_finnhub(ticker: str, api_key: str) -> dict:
    import urllib.request
    import json

    url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={api_key}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return {"error": f"finnhub request failed: {e}"}

    if data.get("c", 0) == 0 and data.get("dp") is None:
        return {"error": "ticker not found"}

    return {
        "price": data["c"],
        "change_pct": data.get("dp") or 0.0,
        "volume": 0,
        "timestamp": datetime.fromtimestamp(data["t"], tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if data.get("t")
        else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    tickers = [t.upper() for t in sys.argv[1:] if t.strip()]
    if not tickers:
        print("Usage: python fetch_prices.py TICKER [TICKER ...]", file=sys.stderr)
        sys.exit(1)

    finnhub_key = os.environ.get("FINNHUB_API_KEY", "")
    results = {}

    # Try yfinance first
    try:
        results = fetch_via_yfinance(tickers)
    except Exception as e:
        # yfinance failed entirely — mark all as needing fallback
        for t in tickers:
            results[t] = {"error": f"yfinance failed: {e}"}

    # For any failures, try Finnhub if key is available
    if finnhub_key:
        for ticker in tickers:
            if "error" in results.get(ticker, {}):
                time.sleep(0.05)  # gentle rate limiting
                results[ticker] = fetch_via_finnhub(ticker, finnhub_key)

    # Emit output
    for ticker in tickers:
        r = results.get(ticker, {"error": "unknown"})
        if "error" in r:
            print(f"ERROR: {ticker} | {r['error']}")
        else:
            sign = "+" if r["change_pct"] >= 0 else ""
            print(
                f"{ticker} | {r['price']:.2f} | {sign}{r['change_pct']:.2f}% | {r['volume']} | {r['timestamp']}"
            )


if __name__ == "__main__":
    main()
