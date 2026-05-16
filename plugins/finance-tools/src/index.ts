import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/core";
import { Type } from "typebox";

import { createFetchPricesTool } from "./stock.js";
import { createFetchNewsTool } from "./news.js";
import { createSendAlertTool } from "./alerts.js";
import { createCheckRecentAlertsTool } from "./memory.js";

export default definePluginEntry({
  id: "finance-tools",
  name: "Finance Tools",
  description: "Stock price monitoring, news fetching, and Telegram alerts for autonomous financial monitoring",

  register(api) {
    // Step 2 — ping tool: verifies the plugin loads and the tool-call pipeline works
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

    // Steps 3–5 — real tools (stubs until each step is implemented)
    api.registerTool(createFetchPricesTool());
    api.registerTool(createFetchNewsTool());
    api.registerTool(createSendAlertTool());
    api.registerTool(createCheckRecentAlertsTool());
  },
});
