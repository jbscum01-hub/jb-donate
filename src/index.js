process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));
process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));


import http from "http";
import { createClient } from "./discord/client.js";
import { routeInteraction } from "./discord/router.js";
import { ENV } from "./config/env.js";
import { IDS } from "./config/constants.js";
import { runVipTick } from "./jobs/vipRunner.js";

const client = createClient();

// ===== Render Keep Alive HTTP Server =====
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Discord bot is running\n");
}).listen(PORT, () => {
  console.log(`🌐 HTTP server running on port ${PORT}`);
});

// ===== VIP Tick Scheduler (no cron needed) =====
const SIX_HOURS = 6 * 60 * 60 * 1000;
let vipRunning = false;

async function vipTickSafe() {
  if (vipRunning) return;
  vipRunning = true;
  try {
    const r = await runVipTick(client);
    console.log(`🟣 VIP tick done:`, r);
  } catch (e) {
    console.error("VIP tick error:", e);
  } finally {
    vipRunning = false;
  }
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Shop Channel: ${IDS.SHOP_CHANNEL_ID}`);

  // run once on startup (optional but useful)
  await vipTickSafe();

  // then every 6 hours
  setInterval(vipTickSafe, SIX_HOURS);
});

client.on("interactionCreate", async (interaction) => {
  await routeInteraction(interaction);
});

client.login(ENV.DISCORD_TOKEN);
