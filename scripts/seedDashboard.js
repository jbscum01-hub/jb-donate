import { createClient } from "../src/discord/client.js";
import { ENV } from "../src/config/env.js";
import { IDS } from "../src/config/constants.js";
import { buildAdminDashboardMessage } from "../src/discord/panels/adminDashboard.js";
import { loadRuntimeDiscordConfig, setRuntimeConfig } from "../src/config/runtimeConfig.js";

async function main() {
  const client = createClient();

  client.once("ready", async () => {
    try {
      await loadRuntimeDiscordConfig();
      const channelId = IDS.ADMIN_DASHBOARD_CHANNEL_ID;
      if (!channelId) throw new Error("Missing ADMIN_DASHBOARD_CHANNEL_ID (DB/ENV)");

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) throw new Error(`Cannot fetch channel ${channelId}`);

      const payload = await buildAdminDashboardMessage(client, "dashboard");
      const messageId = IDS.ADMIN_DASHBOARD_MESSAGE_ID || "";

      if (messageId) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          await msg.edit(payload);
          console.log(`✅ Admin dashboard updated: ${msg.id}`);
          await client.destroy();
          process.exit(0);
          return;
        }
        console.warn(`⚠️ ADMIN_DASHBOARD_MESSAGE_ID not found: ${messageId}`);
      }

      const created = await channel.send(payload);
      await created.pin().catch(() => {});
      await setRuntimeConfig("ADMIN_DASHBOARD_CHANNEL_ID", channel.id);
      await setRuntimeConfig("ADMIN_DASHBOARD_MESSAGE_ID", created.id);
      console.log(`✅ Admin dashboard created: ${created.id}`);
      console.log("➡️ Saved ADMIN_DASHBOARD_MESSAGE_ID to tb_donate_discord_config");
      await client.destroy();
      process.exit(0);
    } catch (err) {
      console.error("seedDashboard error:", err);
      await client.destroy().catch(() => {});
      process.exit(1);
    }
  });

  await client.login(ENV.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
