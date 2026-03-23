import { createClient } from "../src/discord/client.js";
import { ENV } from "../src/config/env.js";
import { IDS } from "../src/config/constants.js";
import { buildShopPanels } from "../src/discord/panels/shopPanel.js";
import { loadRuntimeDiscordConfig, setRuntimeConfig } from "../src/config/runtimeConfig.js";
import { ShopPanelRepo } from "../src/db/repo/shopPanel.repo.js";

const client = createClient();

client.once("ready", async () => {
  await loadRuntimeDiscordConfig();
  const channelId = IDS.SHOP_CHANNEL_ID;
  if (!channelId) throw new Error("Missing SHOP_CHANNEL_ID (DB/ENV)");

  const ch = await client.channels.fetch(channelId);
  const existing = await ShopPanelRepo.listByChannel(channelId);
  const existingMap = new Map(existing.map((row) => [row.panel_key, row]));
  const panels = await buildShopPanels();

  const activeKeys = [];
  const messages = [];

  for (const [index, panel] of panels.entries()) {
    let msg = null;
    const existingRow = existingMap.get(panel.panelKey);

    if (existingRow?.message_id) {
      msg = await ch.messages.fetch(existingRow.message_id).catch(() => null);
    }

    if (msg) {
      await msg.edit(panel.payload);
    } else {
      msg = await ch.send(panel.payload);
      if (index === 0) {
        await msg.pin().catch(() => {});
      }
    }

    await ShopPanelRepo.upsert({
      channelId,
      panelKey: panel.panelKey,
      packId: panel.packId,
      packCode: panel.packCode,
      messageId: msg.id,
      sortOrder: panel.sortOrder,
      isActive: true,
    });

    activeKeys.push(panel.panelKey);
    messages.push(msg);
  }

  const staleRows = await ShopPanelRepo.deactivateMissing(channelId, activeKeys);
  for (const row of staleRows) {
    const staleMsg = await ch.messages.fetch(row.message_id).catch(() => null);
    if (staleMsg) {
      await staleMsg.delete().catch(() => {});
    }
  }

  if (messages[0]?.id) {
    await setRuntimeConfig("SHOP_CHANNEL_ID", ch.id);
    await setRuntimeConfig("PANEL_MESSAGE_ID", messages[0].id);
  }

  console.log(`✅ Shop panels synced: ${messages.length}`);
  console.log(`➡️ Saved PANEL_MESSAGE_ID to tb_donate_discord_config (intro panel)`);
  process.exit(0);
});

client.login(ENV.DISCORD_TOKEN);
