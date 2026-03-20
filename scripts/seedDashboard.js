import "dotenv/config";
import { createClient } from "../src/discord/client.js";
import { buildAdminDashboardMessage } from "../src/discord/panels/adminDashboard.js";
import { ENV } from "../src/config/env.js";

async function main() {
  const client = createClient();

  client.once("ready", async () => {
    try {
      const channel = await client.channels.fetch(ENV.ADMIN_DASHBOARD_CHANNEL_ID).catch(() => null);
      if (!channel) {
        throw new Error(`Cannot fetch ADMIN_DASHBOARD_CHANNEL_ID: ${ENV.ADMIN_DASHBOARD_CHANNEL_ID}`);
      }

      const payload = await buildAdminDashboardMessage(client);
      let msg = null;

      if (ENV.ADMIN_DASHBOARD_MESSAGE_ID) {
        msg = await channel.messages.fetch(ENV.ADMIN_DASHBOARD_MESSAGE_ID).catch(() => null);
      }

      if (msg) {
        await msg.edit(payload);
        console.log(`✅ Dashboard updated: ${msg.id}`);
      } else {
        const created = await channel.send(payload);
        console.log(`✅ Dashboard created: ${created.id}`);
        console.log(`➡️ Put this in ENV: ADMIN_DASHBOARD_MESSAGE_ID=${created.id}`);
      }
    } catch (err) {
      console.error("❌ seedDashboard failed:", err);
      process.exitCode = 1;
    } finally {
      setTimeout(() => client.destroy(), 500);
    }
  });

  await client.login(ENV.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error("❌ seedDashboard fatal:", err);
  process.exit(1);
});
