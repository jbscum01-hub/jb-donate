import { createClient } from "../src/discord/client.js";
import { ENV } from "../src/config/env.js";
import { buildAdminDashboardMessage } from "../src/discord/panels/adminDashboard.js";

async function main() {
  const client = createClient();

  client.once("ready", async () => {
    try {
      const channel = await client.channels.fetch(ENV.ADMIN_DASHBOARD_CHANNEL_ID).catch(() => null);
      if (!channel) throw new Error(`Cannot fetch channel ${ENV.ADMIN_DASHBOARD_CHANNEL_ID}`);

      const payload = await buildAdminDashboardMessage(client, "dashboard");
      let messageId = ENV.ADMIN_DASHBOARD_MESSAGE_ID || "";

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
      console.log(`✅ Admin dashboard created: ${created.id}`);
      console.log(`➡️ Set ADMIN_DASHBOARD_MESSAGE_ID=${created.id}`);
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
