import "dotenv/config";
import dns from "dns";
import http from "http";
import { fetch } from "undici";

import { createClient } from "./discord/client.js";
import { routeInteraction } from "./discord/router.js";
import { ENV } from "./config/env.js";
import { IDS } from "./config/constants.js";
import { runVipTick } from "./jobs/vipRunner.js";

/* ===============================
   FIX DNS (Render / IPv6 issue)
================================ */
dns.setDefaultResultOrder("ipv4first");

/* ===============================
   GLOBAL ERROR HANDLERS
================================ */
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err)
);
process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err)
);

/* ===============================
   DISCORD CLIENT
================================ */
const client = createClient();

client.on("warn", (m) => console.warn("[discord.warn]", m));
client.on("error", (e) => console.error("[discord.error]", e));
client.on("shardError", (e) => console.error("[discord.shardError]", e));

/* ===============================
   RENDER KEEP-ALIVE HTTP
================================ */
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    }
    res.writeHead(200);
    res.end("Discord bot is running\n");
  })
  .listen(PORT, () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
  });

/* ===============================
   STEP 2: PING DISCORD GATEWAY
================================ */
async function pingDiscordGateway() {
  console.log("🌍 Checking Discord gateway connectivity...");
  try {
    const res = await fetch("https://discord.com/api/v10/gateway", {
      method: "GET",
      headers: { "User-Agent": "jb-donate-bot/1.0" },
    });
    console.log("🌍 Discord gateway status:", res.status);
  } catch (err) {
    console.error("🌍 Discord gateway ping FAILED:", err);
  }
}

await pingDiscordGateway();

/* ===============================
   VIP TICK
================================ */
const SIX_HOURS = 6 * 60 * 60 * 1000;
let vipRunning = false;

async function vipTickSafe() {
  if (vipRunning) return;
  vipRunning = true;
  try {
    const r = await runVipTick(client);
    console.log("🟣 VIP tick done:", r);
  } catch (e) {
    console.error("VIP tick error:", e);
  } finally {
    vipRunning = false;
  }
}

/* ===============================
   DISCORD READY
================================ */
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📦 Shop Channel: ${IDS.SHOP_CHANNEL_ID}`);

  await vipTickSafe();
  setInterval(vipTickSafe, SIX_HOURS);
});

client.on("interactionCreate", async (interaction) => {
  await routeInteraction(interaction);
});

/* ===============================
   LOGIN + DEADLINE GUARD
================================ */
console.log("🔐 Attempting Discord login...");

const LOGIN_DEADLINE_MS = 60_000;
const loginDeadline = setTimeout(() => {
  console.error(
    `❌ Discord did not become READY within ${
      LOGIN_DEADLINE_MS / 1000
    }s. Likely NETWORK / DNS issue. Restarting...`
  );
  process.exit(1);
}, LOGIN_DEADLINE_MS);

client.once("ready", () => clearTimeout(loginDeadline));

client.login(ENV.DISCORD_TOKEN).catch((e) => {
  console.error("❌ Discord login failed:", e);
  process.exit(1);
});
