import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

export async function openOrderModal(interaction) {
  try {
    const [type, code] = interaction.values[0].split(":");

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
      .setRequired(true)
      .setMinLength(17)
      .setMaxLength(17);

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

    // ✅ ต้องตอบทันที: ห้ามมี await อื่นก่อนหน้านี้
    return await interaction.showModal(modal);
  } catch (err) {
    console.error("openOrderModal error:", err);
    // fallback
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: "❌ เปิดฟอร์มไม่ทัน กรุณากดเลือกแพ็กอีกครั้ง", ephemeral: true }).catch(() => {});
    }
  }
}
