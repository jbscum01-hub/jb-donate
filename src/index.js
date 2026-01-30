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

// ===== Render Keep Alive HTTP Server =====
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
async function ensureAdminDashboardMessage(client) {
  const channelId = process.env.ADMIN_DASHBOARD_CHANNEL_ID;
  if (!channelId) {
    console.warn("⚠️ ADMIN_DASHBOARD_CHANNEL_ID is not set");
    return null;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error("❌ Cannot fetch admin dashboard channel:", channelId);
    return null;
  }

  // สร้าง payload dashboard (Embed + Buttons)
  const payload = await buildAdminDashboardMessage(client);

  const existingId = process.env.ADMIN_DASHBOARD_MESSAGE_ID;

  // ถ้ามี id อยู่แล้ว ลอง fetch ดูว่า message ยังอยู่ไหม
  if (existingId) {
    const msg = await channel.messages.fetch(existingId).catch(() => null);
    if (msg) {
      // จะ edit หรือไม่ edit ก็ได้ — ที่นี่ขอ update content ให้รู้ว่าใช้งานอยู่
      await msg.edit(payload).catch(() => {});
      console.log("✅ Admin dashboard message exists:", msg.id);
      return msg.id;
    }
    console.warn("⚠️ ADMIN_DASHBOARD_MESSAGE_ID not found, will create a new one:", existingId);
  }

  // ยังไม่มี id หรือหาไม่เจอ → สร้างใหม่
  const created = await channel.send(payload);
  console.log("✅ Admin dashboard message created:", created.id);
  console.log("➡️ Copy this value to Railway ENV: ADMIN_DASHBOARD_MESSAGE_ID =", created.id);
  return created.id;
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Shop Channel: ${IDS.SHOP_CHANNEL_ID}`);

    // ✅ สร้าง/ตรวจ Admin Dashboard message (เพื่อให้ได้ Message ID)
  if (process.env.SEND_ADMIN_DASHBOARD_ON_START === "true") {
    await ensureAdminDashboardMessage(client);
  }
  
  await vipTickSafe();
  setInterval(vipTickSafe, SIX_HOURS);
});

client.on("interactionCreate", async (interaction) => {
  await routeInteraction(interaction);
});

// ===== Login with backoff retry (สำคัญ: ห้าม exit วนจนยิง gateway รัว) =====
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
      return; // READY จะยิงจาก client.once("ready") เอง
    } catch (e) {
      // ถ้าเป็น rate limit / network อย่ารันถี่
      const msg = e?.message || String(e);
      console.error("❌ Discord login failed:", e);

      // backoff: 30s, 60s, 120s, ... max 10m
      const waitMs = Math.min(10 * 60_000, 30_000 * Math.pow(2, Math.min(attempt, 5)));
      console.warn(`⏳ Will retry login in ${Math.round(waitMs / 1000)}s... (${msg})`);

      loginInFlight = false;
      await new Promise((r) => setTimeout(r, waitMs));
      // loop ต่อเอง
      loginInFlight = true;
    }
  }
}

loginWithRetry();
