import { createClient } from "./discord/client.js";
import { routeInteraction } from "./discord/router.js";
import { ENV } from "./config/env.js";
import { IDS } from "./config/constants.js";

const client = createClient();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Shop Channel: ${IDS.SHOP_CHANNEL_ID}`);
});

client.on("interactionCreate", async (interaction) => {
  await routeInteraction(interaction);
});

client.login(ENV.DISCORD_TOKEN);
