// src/jobs/vipTick.js
import { createClient } from "../discord/client.js";
import { runVipTick } from "./vipRunner.js";

const client = createClient();

client.once("ready", async () => {
  try {
    await runVipTick(client);
  } finally {
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
