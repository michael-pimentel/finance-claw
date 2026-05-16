#!/usr/bin/env python3
"""
fetch_news.py — Fetch recent news headlines for a ticker.

Usage:
    python scripts/fetch_news.py NVDA
    python scripts/fetch_news.py NVDA --hours 48

Output: Up to 5 headlines, most recent first.
On failure: NO_NEWS: reason
"""

import sys
import os
import argparse
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime


# ---------------------------------------------------------------------------
# Primary: Yahoo Finance RSS
# ---------------------------------------------------------------------------

def fetch_yahoo_rss(ticker: str, hours_back: int) -> list[dict]:
    import urllib.request
    import feedparser

    url = f"https://finance.yahoo.com/rss/headline?s={ticker}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            raw = resp.read()
        feed = feedparser.parse(raw)
    except Exception as e:
        raise RuntimeError(f"Yahoo RSS request failed: {e}")

    if not feed.entries:
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    articles = []

    for entry in feed.entries[:20]:
        try:
            pub = parsedate_to_datetime(entry.get("published", ""))
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
            if pub < cutoff:
                continue
        except Exception:
            pub = datetime.now(timezone.utc)

        articles.append({
            "title": entry.get("title", "").strip(),
            "source": entry.get("source", {}).get("title", "Yahoo Finance") if isinstance(entry.get("source"), dict) else "Yahoo Finance",
            "url": entry.get("link", ""),
            "published_at": pub.strftime("%Y-%m-%d %H:%M ET"),
            "description": entry.get("summary", "").strip()[:200],
        })

    articles.sort(key=lambda a: a["published_at"], reverse=True)
    return articles[:5]


# ---------------------------------------------------------------------------
# Fallback: NewsAPI (supports both newsapi.org and newsapi.ai UUID keys)
# ---------------------------------------------------------------------------

def fetch_newsapi(ticker: str, hours_back: int, api_key: str) -> list[dict]:
    import urllib.request
    import urllib.parse
    import json

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours_back)).strftime("%Y-%m-%dT%H:%M:%SZ")

    # newsapi.ai uses UUID keys; newsapi.org uses alphanumeric
    is_ai_key = len(api_key) == 36 and api_key.count("-") == 4

    if is_ai_key:
        # newsapi.ai endpoint
        params = urllib.parse.urlencode({
            "q": ticker,
            "language": "eng",
            "sortBy": "date",
            "pageSize": 5,
            "apiKey": api_key,
        })
        url = f"https://newsapi.ai/api/v1/article/getArticles?{params}"
        try:
            with urllib.request.urlopen(url, timeout=8) as resp:
                data = json.loads(resp.read())
            raw_articles = data.get("articles", {}).get("results", [])
            articles = []
            for a in raw_articles[:5]:
                articles.append({
                    "title": a.get("title", "").strip(),
                    "source": a.get("source", {}).get("title", "NewsAPI.ai"),
                    "url": a.get("url", ""),
                    "published_at": a.get("dateTime", "")[:16].replace("T", " ") + " UTC",
                    "description": (a.get("body") or "")[:200],
                })
            return articles
        except Exception as e:
            raise RuntimeError(f"NewsAPI.ai request failed: {e}")
    else:
        # newsapi.org endpoint
        params = urllib.parse.urlencode({
            "q": ticker,
            "from": cutoff,
            "sortBy": "publishedAt",
            "pageSize": 5,
            "apiKey": api_key,
        })
        url = f"https://newsapi.org/v2/everything?{params}"
        try:
            with urllib.request.urlopen(url, timeout=8) as resp:
                data = json.loads(resp.read())
            raw_articles = data.get("articles", [])
            articles = []
            for a in raw_articles[:5]:
                articles.append({
                    "title": a.get("title", "").strip(),
                    "source": a.get("source", {}).get("name", "NewsAPI"),
                    "url": a.get("url", ""),
                    "published_at": (a.get("publishedAt") or "")[:16].replace("T", " ") + " UTC",
                    "description": (a.get("description") or "")[:200],
                })
            return articles
        except Exception as e:
            raise RuntimeError(f"NewsAPI.org request failed: {e}")


# ---------------------------------------------------------------------------
# Output formatter
# ---------------------------------------------------------------------------

def print_articles(articles: list[dict]) -> None:
    for i, a in enumerate(articles, 1):
        print(f"[{i}] Title: {a['title']}")
        print(f"    Source: {a['source']} | Published: {a['published_at']}")
        print(f"    URL: {a['url']}")
        if a.get("description"):
            print(f"    Summary: {a['description']}")
        print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Fetch news for a ticker")
    parser.add_argument("ticker", help="Ticker symbol, e.g. NVDA")
    parser.add_argument("--hours", type=int, default=24, help="Hours back to search (default: 24)")
    args = parser.parse_args()

    ticker = args.ticker.upper()
    hours_back = args.hours
    news_api_key = os.environ.get("NEWSAPI_KEY", "")

    articles = []
    error_msg = ""

    try:
        articles = fetch_yahoo_rss(ticker, hours_back)
    except Exception as e:
        error_msg = str(e)

    if not articles and news_api_key:
        try:
            articles = fetch_newsapi(ticker, hours_back, news_api_key)
            error_msg = ""
        except Exception as e:
            error_msg = f"Both sources failed. Yahoo: {error_msg} | NewsAPI: {e}"

    if not articles:
        reason = error_msg if error_msg else f"no articles found for {ticker} in the last {hours_back} hours"
        print(f"NO_NEWS: {reason}")
        return

    print_articles(articles)


if __name__ == "__main__":
    main()
