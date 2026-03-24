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
import { loadRuntimeDiscordConfig, setRuntimeConfig } from "./config/runtimeConfig.js";
import { runVipTick } from "./jobs/vipRunner.js";
import { runServerStatusJob } from "./jobs/serverStatus.job.js";
import { runRestartNotifyJob } from "./jobs/restartNotify.job.js";
import { buildAdminDashboardMessage } from "./discord/panels/adminDashboard.js";
import { AuditRepo } from "./db/repo/audit.repo.js";

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
let serverStatusRunning = false;
let restartNotifyRunning = false;

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

async function serverStatusTickSafe() {
  if (serverStatusRunning) return;
  serverStatusRunning = true;
  try {
    const result = await runServerStatusJob(client);
    if (!result?.skipped) {
      console.log('📊 Server status updated:', result);
    }
  } catch (e) {
    console.error('Server status tick error:', e);
  } finally {
    serverStatusRunning = false;
  }
}


async function restartNotifyTickSafe() {
  if (restartNotifyRunning) return;
  restartNotifyRunning = true;
  try {
    const result = await runRestartNotifyJob(client);
    if (!result?.skipped) {
      console.log('🔔 Restart notify sent:', result);
    }
  } catch (e) {
    console.error('Restart notify tick error:', e);
  } finally {
    restartNotifyRunning = false;
  }
}

function getServerStatusRefreshMs() {
  const seconds = Number(IDS.SERVER_STATUS_REFRESH_SECONDS || 60);
  if (!Number.isFinite(seconds) || seconds < 30) return 60 * 1000;
  return seconds * 1000;
}

async function ensureAdminDashboardMessage(client) {
  const channelId = IDS.ADMIN_DASHBOARD_CHANNEL_ID;
  if (!channelId) {
    console.warn("⚠️ ADMIN_DASHBOARD_CHANNEL_ID is not set (DB/ENV)");
    return null;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error("❌ Cannot fetch admin dashboard channel:", channelId);
    return null;
  }

  const payload = await buildAdminDashboardMessage(client, "dashboard");
  const existingId = IDS.ADMIN_DASHBOARD_MESSAGE_ID;

  if (existingId) {
    const msg = await channel.messages.fetch(existingId).catch(() => null);
    if (msg) {
      await msg.edit(payload).catch((e) => console.error("edit admin dashboard failed:", e));
      await AuditRepo.add({ guildId: ENV.GUILD_ID, actorId: client.user?.id ?? null, actorTag: client.user?.tag ?? "bot", action: "ADMIN_PANEL_BOOT_REFRESH", target: msg.id, meta: { channel_id: channel.id } }).catch(() => {});
      console.log("✅ Admin dashboard message updated:", msg.id);
      return msg.id;
    }
    console.warn("⚠️ ADMIN_DASHBOARD_MESSAGE_ID not found in DB/ENV, will create a new one:", existingId);
  }

  const created = await channel.send(payload);
  await created.pin().catch(() => {});
  await setRuntimeConfig("ADMIN_DASHBOARD_CHANNEL_ID", channel.id);
  await setRuntimeConfig("ADMIN_DASHBOARD_MESSAGE_ID", created.id);
  await AuditRepo.add({ guildId: ENV.GUILD_ID, actorId: client.user?.id ?? null, actorTag: client.user?.tag ?? "bot", action: "ADMIN_PANEL_BOOT_DEPLOY", target: created.id, meta: { channel_id: channel.id } }).catch(() => {});
  console.log("✅ Admin dashboard message created:", created.id);
  console.log("➡️ Saved ADMIN_DASHBOARD_MESSAGE_ID to tb_donate_discord_config");
  return created.id;
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loadRuntimeDiscordConfig();
  console.log(`Shop Channel: ${IDS.SHOP_CHANNEL_ID || "(not set)"}`);

  if (ENV.SEND_ADMIN_DASHBOARD_ON_START || IDS.ADMIN_DASHBOARD_MESSAGE_ID || IDS.ADMIN_DASHBOARD_CHANNEL_ID) {
    await ensureAdminDashboardMessage(client);
  }

  await vipTickSafe();
  setInterval(vipTickSafe, SIX_HOURS);

  await serverStatusTickSafe();
  setInterval(serverStatusTickSafe, getServerStatusRefreshMs());

  await restartNotifyTickSafe();
  setInterval(restartNotifyTickSafe, 30 * 1000);
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
