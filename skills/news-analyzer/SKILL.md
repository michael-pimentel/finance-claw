# Skill: news-analyzer

Fetches recent news headlines for a ticker to explain a price move.

## Script

```
python scripts/fetch_news.py NVDA
```

## Output Format

Up to 5 headlines, most recent first:
```
[1] Title: NVIDIA Announces New AI Partnership
    Source: Reuters | Published: 2024-05-15 13:45 ET
    URL: https://...
    Summary: NVIDIA expanded its AI chip supply agreements with three Asian manufacturers...

[2] Title: ...
```

If no articles found:
```
NO_NEWS: No articles found for NVDA in the last 24 hours.
```

## Data Sources

Primary: Yahoo Finance RSS (`https://finance.yahoo.com/rss/headline?s={ticker}`)
Fallback: NewsAPI (`NEWSAPI_KEY` env var — newsapi.ai UUID format or newsapi.org alphanumeric)

## When to Call

Only for tickers that crossed the movement threshold in the current cycle.
Do not call for every ticker on every cycle.

## Interpretation Guide

When reading output, look for:
- Earnings announcements or guidance changes
- M&A activity (acquisition, merger, spinoff)
- Regulatory action (SEC, FTC, FDA, DOJ)
- Executive changes (CEO departure, new appointment)
- Macro news affecting the sector (Fed rate decision, tariff policy)
- Analyst rating changes or price target updates
- Product launches or major contract wins

If none of these appear and the move is ≥3%, flag the alert as "anomalous — no catalyst identified."
