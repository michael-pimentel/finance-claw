import { Type } from "typebox";
import { jsonResult, type AlertPayload } from "./types.js";
import { recordAlert } from "./memory.js";

const TELEGRAM_BASE = "https://api.telegram.org";

type TelegramResult =
  | { ok: true; message_id: number }
  | { ok: false; error: string };

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<TelegramResult> {
  const url = `${TELEGRAM_BASE}/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  const data = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!data.ok) {
    return { ok: false, error: data.description ?? `HTTP ${res.status}` };
  }
  return { ok: true, message_id: data.result?.message_id ?? 0 };
}

function formatAlertMessage(params: AlertPayload): string {
  const sign = params.change_pct >= 0 ? "+" : "";
  const lines: string[] = [
    `<b>📊 FinanceClaw Alert: ${params.ticker}</b>`,
    `<b>${sign}${params.change_pct.toFixed(2)}%</b>`,
    "",
    params.summary,
  ];
  if (params.headline) {
    lines.push("", `📰 <i>${params.headline}</i>`);
  }
  if (params.url) {
    lines.push(`🔗 ${params.url}`);
  }
  return lines.join("\n");
}

export function createSendAlertTool() {
  return {
    label: "Send Alert",
    name: "send_alert",
    description:
      "Sends a formatted alert message to the configured Telegram chat and records it to prevent duplicate alerts. " +
      "Call this ONLY after you have decided the event is material and not already covered by a recent alert. " +
      "The summary should be one sentence: what happened and why it might matter. " +
      "Include headline and url if a specific article triggered the alert. " +
      "Returns { delivered: true, message_id: number } on success, or { delivered: false, error: string } on failure. " +
      "A failed delivery does NOT mean you should retry immediately — log it and continue the cycle.",
    parameters: Type.Object({
      ticker: Type.String({ description: "Ticker symbol, e.g. 'NVDA'" }),
      summary: Type.String({
        description: "One-sentence summary: what happened and why it matters",
        minLength: 10,
      }),
      change_pct: Type.Number({ description: "Percentage price change that triggered this alert" }),
      headline: Type.Optional(Type.String({ description: "Most relevant news headline, if applicable" })),
      url: Type.Optional(Type.String({ description: "URL of the most relevant article" })),
    }),
    execute: async (_id: string, params: AlertPayload) => {
      // Hard dedup — enforce at code level regardless of whether the agent checked
      const { getRecentAlerts } = await import("./memory.js");
      const recent = getRecentAlerts(params.ticker, 4);
      if (recent.length > 0) {
        return jsonResult({
          delivered: false,
          skipped: true,
          reason: `Duplicate suppressed — already alerted on ${params.ticker} at ${recent[0]!.created_at}`,
        });
      }

      const botToken = process.env["TELEGRAM_BOT_TOKEN"];
      const chatId = process.env["TELEGRAM_CHAT_ID"];

      if (!botToken || !chatId) {
        recordAlert(params.ticker, params.summary, params.change_pct);
        return jsonResult({
          delivered: false,
          error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — alert recorded locally only",
        });
      }

      const text = formatAlertMessage(params);
      const result = await sendTelegramMessage(botToken, chatId, text);

      // Always record locally, even if Telegram delivery fails
      recordAlert(params.ticker, params.summary, params.change_pct);

      if (!result.ok) {
        return jsonResult({ delivered: false, error: result.error });
      }
      return jsonResult({ delivered: true, message_id: result.message_id });
    },
  };
}
