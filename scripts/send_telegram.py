#!/usr/bin/env python3
"""
send_telegram.py — Send an alert message via Telegram Bot API.

Usage:
    python scripts/send_telegram.py "NVDA +4.2% — NVIDIA expanded H100 partnerships."
    echo "message" | python scripts/send_telegram.py

Environment:
    TELEGRAM_BOT_TOKEN  — from @BotFather
    TELEGRAM_CHAT_ID    — your chat or channel ID

Fallback: if env vars are missing, writes to alerts.log and prints to stdout.
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
    line = f"[{ts}] {message}\n"
    print(f"[ALERT LOG] {message}")
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except OSError as e:
        print(f"[WARNING] Could not write to alerts.log: {e}", file=sys.stderr)


def send_telegram(bot_token: str, chat_id: str, message: str) -> bool:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data.get("ok"):
                msg_id = data.get("result", {}).get("message_id", "?")
                print(f"[TELEGRAM] Delivered (message_id={msg_id})")
                return True
            else:
                print(f"[TELEGRAM ERROR] {data.get('description', 'unknown error')}", file=sys.stderr)
                return False
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[TELEGRAM ERROR] HTTP {e.code}: {body}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[TELEGRAM ERROR] {e}", file=sys.stderr)
        return False


def main():
    # Read message from CLI arg or stdin
    if len(sys.argv) > 1:
        message = " ".join(sys.argv[1:])
    elif not sys.stdin.isatty():
        message = sys.stdin.read().strip()
    else:
        print("Usage: send_telegram.py <message>  or  echo <message> | send_telegram.py", file=sys.stderr)
        sys.exit(1)

    if not message:
        print("[WARNING] Empty message — nothing to send.", file=sys.stderr)
        sys.exit(0)

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not bot_token or not chat_id:
        print("[INFO] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — logging locally.")
        log_locally(message)
        sys.exit(0)

    success = send_telegram(bot_token, chat_id, message)
    if not success:
        log_locally(message)
        sys.exit(1)


if __name__ == "__main__":
    main()
