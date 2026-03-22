import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";

function money(v) {
  return `${Number(v || 0).toLocaleString("th-TH")} บาท`;
}

function buildPackDetailsEmbed(details) {
  const lines = [];
  if (details.description) lines.push(details.description);
  if (details.benefits?.length) lines.push("", ...details.benefits.map((x) => `🎁 ${x}`));
  if (details.displayItems?.length) lines.push("", ...details.displayItems.map((x) => `📦 ${x}`));
  if (details.vehicleChoices?.length) lines.push("", ...details.vehicleChoices.map((x) => `🚗 ${x}`));
  if (details.boatChoices?.length) lines.push("", ...details.boatChoices.map((x) => `🛥️ ${x}`));
  if (Number(details.car_insurance_total || 0) > 0) {
    lines.push("", `🛡️ ประกันรถ ${details.car_insurance_total} ครั้ง / ${details.car_insurance_days || 0} วัน`);
  }
  if (Number(details.boat_insurance_total || 0) > 0) {
    lines.push(`🛡️ ประกันเรือ ${details.boat_insurance_total} ครั้ง / ${details.boat_insurance_days || 0} วัน`);
  }

  const embed = new EmbedBuilder()
    .setColor(details.embed_color ?? 0x5865f2)
    .setTitle(`📦 ${details.pack_name} — ${money(details.price)}`)
    .setDescription(lines.join("\n").slice(0, 4096) || "-")
    .addFields(
      { name: "Code", value: `\`${details.pack_code}\``, inline: true },
      { name: "Type", value: details.pack_type || "DONATE", inline: true },
      { name: "Price", value: money(details.price), inline: true },
    );

  if (details.image_url) {
    embed.setImage(details.image_url);
  }

  return embed;
}

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

    const buyBtn = new ButtonBuilder()
      .setCustomId(`shop:buy:${details.pack_type}:${details.pack_code}`)
      .setLabel("ซื้อแพ็กนี้")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Success);

    return interaction.reply({
      embeds: [buildPackDetailsEmbed(details)],
      components: [new ActionRowBuilder().addComponents(buyBtn)],
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
