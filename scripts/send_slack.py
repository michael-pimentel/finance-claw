#!/usr/bin/env python3
"""
send_slack.py — Send an alert message via Slack Incoming Webhook.

Usage:
    python scripts/send_slack.py "NVDA +4.2% — NVIDIA expanded H100 partnerships."
    echo "message" | python scripts/send_slack.py

Environment:
    SLACK_WEBHOOK_URL — Incoming Webhook URL from your Slack app config

Fallback: if env var is missing, writes to alerts.log and prints to stdout.
"""

import sys
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone


LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alerts.log")


def log_locally(message: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] [SLACK] {message}\n"
    print(f"[ALERT LOG] {message}")
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except OSError as e:
        print(f"[WARNING] Could not write to alerts.log: {e}", file=sys.stderr)


def send_slack(webhook_url: str, message: str) -> bool:
    payload = json.dumps({"text": message}).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            if body.strip() == "ok":
                print("[SLACK] Delivered")
                return True
            else:
                print(f"[SLACK ERROR] Unexpected response: {body}", file=sys.stderr)
                return False
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[SLACK ERROR] HTTP {e.code}: {body}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[SLACK ERROR] {e}", file=sys.stderr)
        return False


def main():
    if len(sys.argv) > 1:
        message = " ".join(sys.argv[1:])
    elif not sys.stdin.isatty():
        message = sys.stdin.read().strip()
    else:
        print("Usage: send_slack.py <message>  or  echo <message> | send_slack.py", file=sys.stderr)
        sys.exit(1)

    if not message:
        print("[WARNING] Empty message — nothing to send.", file=sys.stderr)
        sys.exit(0)

    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")

    if not webhook_url:
        print("[INFO] SLACK_WEBHOOK_URL not set — logging locally.")
        log_locally(message)
        sys.exit(0)

    success = send_slack(webhook_url, message)
    if not success:
        log_locally(message)
        sys.exit(1)


if __name__ == "__main__":
    main()
