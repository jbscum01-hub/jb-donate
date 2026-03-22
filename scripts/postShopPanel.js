import { createClient } from "../src/discord/client.js";
import { ENV } from "../src/config/env.js";
import { IDS } from "../src/config/constants.js";
import { buildShopPanel } from "../src/discord/panels/shopPanel.js";
import { loadRuntimeDiscordConfig, setRuntimeConfig } from "../src/config/runtimeConfig.js";

const client = createClient();

client.once("ready", async () => {
  await loadRuntimeDiscordConfig();
  const channelId = IDS.SHOP_CHANNEL_ID;
  if (!channelId) throw new Error("Missing SHOP_CHANNEL_ID (DB/ENV)");

  const ch = await client.channels.fetch(channelId);
  const sent = await ch.send(await buildShopPanel());
  await sent.pin().catch(() => {});
  await setRuntimeConfig("SHOP_CHANNEL_ID", ch.id);
  await setRuntimeConfig("PANEL_MESSAGE_ID", sent.id);
  console.log(`✅ Shop panel posted: ${sent.id}`);
  console.log("➡️ Saved PANEL_MESSAGE_ID to tb_donate_discord_config");
  process.exit(0);
});

client.login(ENV.DISCORD_TOKEN);
