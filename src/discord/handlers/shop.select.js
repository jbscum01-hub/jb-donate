// src/discord/handlers/shop.select.js
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

/**
 * Shop select -> open order modal (NO defer/reply before showModal)
 * value format: TYPE:CODE e.g. DONATE:BRONZE
 */
export async function openOrderModal(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "shop_select") return;

    const raw = interaction.values?.[0];
    if (!raw || !raw.includes(":")) {
      return interaction.reply({ content: "❌ ไม่พบแพ็กที่เลือก", ephemeral: true }).catch(() => {});
    }

    const [type, code] = raw.split(":");
    const modal = new ModalBuilder()
      .setCustomId(`order_create:${type}:${code}`)
      .setTitle(`Order - ${type}:${code}`);

    const ign = new TextInputBuilder()
      .setCustomId("ign")
      .setLabel("IGN (ชื่อตัวละคร)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const steam = new TextInputBuilder()
      .setCustomId("steam")
      .setLabel("SteamID (17 หลัก)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const note = new TextInputBuilder()
      .setCustomId("note")
      .setLabel("หมายเหตุ (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(ign),
      new ActionRowBuilder().addComponents(steam),
      new ActionRowBuilder().addComponents(note),
    );

    return interaction.showModal(modal);
  } catch (err) {
    console.error("openOrderModal error:", err);
    // best effort fallback
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ เปิดฟอร์มไม่สำเร็จ ลองใหม่อีกครั้ง",
        ephemeral: true,
      }).catch(() => {});
    }
  }
}
