import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from "discord.js";

import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { buildShopPackMessage } from "../utils/packDetailEmbed.js";

export function buildOrderModal(type, code) {
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

  return modal;
}

export async function openOrderModal(interaction, rawOverride = null) {
  try {
    const raw = rawOverride || interaction.values?.[0];
    if (!raw || raw === "DISABLED:NO_PACKS" || raw === "__empty__" || !raw.includes(":")) {
      return interaction.reply({ content: "❌ ไม่พบแพ็กที่เลือก", flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const [type, code] = raw.split(":");
    return interaction.showModal(buildOrderModal(type, code));
  } catch (err) {
    console.error("openOrderModal error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ เปิดฟอร์มไม่สำเร็จ ลองใหม่อีกครั้ง",
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  }
}

export async function previewShopPack(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "shop_select") return;

    const raw = interaction.values?.[0];
    if (!raw || raw === "DISABLED:NO_PACKS" || raw === "__empty__" || !raw.includes(":")) {
      return interaction.deferUpdate().catch(() => {});
    }

    const [, code] = raw.split(":");
    const details = await DonatePackRepo.getPackDetails(code);
    if (!details) {
      return interaction.reply({ content: "❌ ไม่พบรายละเอียดแพ็กนี้", flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    return interaction.reply({
      ...buildShopPackMessage(details),
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  } catch (err) {
    console.error("previewShopPack error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ แสดงรายละเอียดแพ็กไม่สำเร็จ ลองใหม่อีกครั้ง",
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  }
}
