import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";

export function buildShopPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🛒 J&B DONATE SHOP")
    .setDescription("เลือกแพ็ก → กรอก IGN/SteamID → บอทจะสร้าง Ticket ให้แนบสลิป");

  const select = new StringSelectMenuBuilder()
    .setCustomId("shop_select")
    .setPlaceholder("เลือกแพ็กที่ต้องการ…")
    .addOptions(
      { label: "BRONZE – 50", value: "DONATE:BRONZE" },
      { label: "SILVER – 100", value: "DONATE:SILVER" },
      { label: "GOLD – 200", value: "DONATE:GOLD" },
      { label: "PLATINUM – 350", value: "DONATE:PLATINUM" },
      { label: "DIAMOND – 500", value: "DONATE:DIAMOND" },
      { label: "⭐ Elite Operator – 399", value: "BOOST:ELITE_OPERATOR" },
      { label: "VIP BASIC – 199", value: "VIP:BASIC" },
      { label: "VIP PRO – 300", value: "VIP:PRO" },
      { label: "VIP ELITE – 500", value: "VIP:ELITE" },
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}
