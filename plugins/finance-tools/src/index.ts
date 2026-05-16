import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/core";
import { Type } from "typebox";

import { createFetchPricesTool } from "./stock.js";
import { createFetchNewsTool } from "./news.js";
import { createSendAlertTool } from "./alerts.js";
import { createCheckRecentAlertsTool } from "./memory.js";
import { createFetchHistoricalPricesTool } from "./historical.js";
import { createFetchInsiderTradesTool } from "./insider.js";
import { createFetchEarningsCalendarTool } from "./earnings.js";
import { createFetchSectorPerformanceTool } from "./sector.js";

export default definePluginEntry({
  id: "finance-tools",
  name: "Finance Tools",
  description:
    "Stock price monitoring, technical analysis, insider trades, earnings calendar, sector context, and Telegram alerts for autonomous financial monitoring",

  register(api) {
    api.registerTool({
      label: "Ping",
      name: "ping",
      description:
        "Health check tool. Returns 'pong' with a timestamp. Call this to confirm the finance-tools plugin is loaded and the tool-call pipeline is working. Do not call this during normal monitoring cycles.",
      parameters: Type.Object({}),
      execute: async (_id, _params) => {
        return jsonResult({ pong: true, timestamp: new Date().toISOString() });
      },
    });

    api.registerTool(createFetchPricesTool());
    api.registerTool(createFetchNewsTool());
    api.registerTool(createSendAlertTool());
    api.registerTool(createCheckRecentAlertsTool());

    // New intelligence tools
    api.registerTool(createFetchHistoricalPricesTool());
    api.registerTool(createFetchInsiderTradesTool());
    api.registerTool(createFetchEarningsCalendarTool());
    api.registerTool(createFetchSectorPerformanceTool());
  },
});
