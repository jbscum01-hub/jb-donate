import { createClient } from "../src/discord/client.js";
import { ENV } from "../src/config/env.js";
import { IDS } from "../src/config/constants.js";
import { buildShopPanel } from "../src/discord/panels/shopPanel.js";

const client = createClient();

client.once("ready", async () => {
  const ch = await client.channels.fetch(IDS.SHOP_CHANNEL_ID);
  await ch.send(buildShopPanel());
  console.log("✅ Shop panel posted");
  process.exit(0);
});

client.login(ENV.DISCORD_TOKEN);
