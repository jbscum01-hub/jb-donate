process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err)
);
process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err)
);

import http from "http";
import { createClient } from "./discord/client.js";
import { routeInteraction } from "./discord/router.js";
import { ENV } from "./config/env.js";
import { IDS } from "./config/constants.js";
import { runVipTick } from "./jobs/vipRunner.js";
import { buildAdminDashboardMessage } from "./discord/panels/adminDashboard.js";

const client = createClient();

const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Discord bot is running\n");
  })
  .listen(PORT, () => console.log(`🌐 HTTP server running on port ${PORT}`));

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

async function ensureAdminDashboardMessage(client) {
  const channelId = ENV.ADMIN_DASHBOARD_CHANNEL_ID;
  if (!channelId) {
    console.warn("⚠️ ADMIN_DASHBOARD_CHANNEL_ID is not set");
    return null;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error("❌ Cannot fetch admin dashboard channel:", channelId);
    return null;
  }

  const payload = await buildAdminDashboardMessage(client);
  const existingId = ENV.ADMIN_DASHBOARD_MESSAGE_ID;

  if (existingId) {
    const msg = await channel.messages.fetch(existingId).catch(() => null);
    if (msg) {
      await msg.edit(payload).catch(() => {});
      console.log("✅ Admin dashboard message exists:", msg.id);
      return msg.id;
    }
    console.warn("⚠️ ADMIN_DASHBOARD_MESSAGE_ID not found, will create a new one:", existingId);
  }

  const created = await channel.send(payload);
  console.log("✅ Admin dashboard message created:", created.id);
  console.log("➡️ Copy this value to Railway ENV: ADMIN_DASHBOARD_MESSAGE_ID =", created.id);
  return created.id;
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Shop Channel: ${IDS.SHOP_CHANNEL_ID}`);

  if (ENV.SEND_ADMIN_DASHBOARD_ON_START === "true") {
    await ensureAdminDashboardMessage(client);
  }

  await vipTickSafe();
  setInterval(vipTickSafe, SIX_HOURS);
});

client.on("interactionCreate", async (interaction) => {
  await routeInteraction(interaction);
});

let loginInFlight = false;
let attempt = 0;

async function loginWithRetry() {
  if (loginInFlight) return;
  loginInFlight = true;

  while (true) {
    try {
      attempt += 1;
      console.log(`🔐 Attempting Discord login... (attempt ${attempt})`);
      await client.login(ENV.DISCORD_TOKEN);
      console.log("🟢 login() resolved (waiting for READY event)...");
      return;
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("❌ Discord login failed:", e);
      const waitMs = Math.min(10 * 60_000, 30_000 * Math.pow(2, Math.min(attempt, 5)));
      console.warn(`⏳ Will retry login in ${Math.round(waitMs / 1000)}s... (${msg})`);

      loginInFlight = false;
      await new Promise((r) => setTimeout(r, waitMs));
      loginInFlight = true;
    }
  }
}

loginWithRetry();
