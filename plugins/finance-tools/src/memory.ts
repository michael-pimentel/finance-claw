import { Type } from "typebox";
import { jsonResult } from "./types.js";
import type { AlertRecord } from "./types.js";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;

  const dir = join(homedir(), ".openclaw", "finance-claw");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "alerts.db");

  _db = new DatabaseSync(dbPath);
  _db.exec(SCHEMA);
  return _db;
}

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    summary TEXT NOT NULL,
    change_pct REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_alerts_ticker_time ON alerts(ticker, created_at);

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export function recordAlert(ticker: string, summary: string, change_pct: number): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO alerts (ticker, summary, change_pct) VALUES (?, ?, ?)"
  ).run(ticker, summary, change_pct);
}

export function getRecentAlerts(ticker: string, sinceHoursAgo: number): AlertRecord[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, ticker, summary, change_pct, created_at
       FROM alerts
      WHERE ticker = ?
        AND created_at > datetime('now', ?)
      ORDER BY created_at DESC`
  ).all(ticker, `-${sinceHoursAgo} hours`) as unknown as AlertRecord[];
  return rows;
}

export function getWatchlist(): string[] {
  const env = process.env["WATCHLIST"];
  return env ? env.split(",").map((t) => t.trim()) : ["NVDA", "MSFT", "GOOGL", "AAPL", "META"];
}

export function setWatchlist(tickers: string[]): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO kv (key, value) VALUES ('watchlist', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(tickers.join(","));
}

export function createCheckRecentAlertsTool() {
  return {
    label: "Check Recent Alerts",
    name: "check_recent_alerts",
    description:
      "Checks whether an alert for this ticker has already been sent within the given time window. " +
      "Always call this BEFORE send_alert to prevent duplicate notifications. " +
      "Returns { alerted: true } if a recent alert exists, along with the time and summary of the last alert. " +
      "Returns { alerted: false } if no alert has been sent in the window. " +
      "Default window is 24 hours. Use a shorter window (e.g. 4 hours) if the price move is exceptionally large (>8%).",
    parameters: Type.Object({
      ticker: Type.String({ description: "Ticker symbol to check, e.g. 'NVDA'" }),
      hours: Type.Optional(
        Type.Number({
          description: "How many hours back to check for existing alerts. Default: 24.",
          minimum: 1,
          maximum: 72,
        })
      ),
    }),
    execute: async (_id: string, params: { ticker: string; hours?: number }) => {
      const hours = params.hours ?? 24;
      const recent = getRecentAlerts(params.ticker, hours);
      if (recent.length === 0) {
        return jsonResult({ alerted: false, last_alert_at: null, last_summary: null });
      }
      const last = recent[0]!;
      return jsonResult({
        alerted: true,
        last_alert_at: last.created_at,
        last_summary: last.summary,
        count_in_window: recent.length,
      });
    },
  };
}
