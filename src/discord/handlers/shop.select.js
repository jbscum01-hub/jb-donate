import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

export async function openOrderModal(interaction) {
  const [type, code] = interaction.values[0].split(":");
  const modal = new ModalBuilder()
    .setCustomId(`order_create:${type}:${code}`)
    .setTitle(`Order - ${type}:${code}`);

  const ign = new TextInputBuilder().setCustomId("ign").setLabel("IGN (ชื่อตัวละคร)").setStyle(TextInputStyle.Short).setRequired(true);
  const steam = new TextInputBuilder().setCustomId("steam").setLabel("SteamID (17 หลัก)").setStyle(TextInputStyle.Short).setRequired(true);
  const note = new TextInputBuilder().setCustomId("note").setLabel("หมายเหตุ (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(ign),
    new ActionRowBuilder().addComponents(steam),
    new ActionRowBuilder().addComponents(note),
  );

  await interaction.showModal(modal);
}
