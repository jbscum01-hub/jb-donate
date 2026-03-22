import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { buildShopPanel } from "../panels/shopPanel.js";
import { safeReply } from "../utils/messages.js";
import { ENV } from "../../config/env.js";

function money(v) {
  return Number(v || 0).toLocaleString("th-TH");
}

function shortText(v, max = 100) {
  const s = String(v ?? "").trim();
  if (!s) return "-";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function parseEditModalFields(interaction) {
  return {
    pack_name: interaction.fields.getTextInputValue("pack_name").trim(),
    pack_type: interaction.fields.getTextInputValue("pack_type").trim().toUpperCase(),
    price: interaction.fields.getTextInputValue("price").trim(),
    sort_order: interaction.fields.getTextInputValue("sort_order").trim(),
    description: interaction.fields.getTextInputValue("description").trim(),
  };
}

function buildPackEmbed(pack, details = null) {
  const data = details ?? pack;
  const summary = data.summary_lines?.length
    ? data.summary_lines.map((x) => `• ${x}`).join("\n")
    : data.panel_summary || data.description || "-";

  const fields = [
    {
      name: "ข้อมูลหลัก",
      value: `Code: **${data.pack_code}**\nชื่อ: **${data.pack_name}**\nประเภท: **${data.pack_type}**\nราคา: **${money(data.price)} บาท**\nลำดับ: **${data.sort_order ?? 0}**\nสถานะ: **${data.is_active ? "ACTIVE" : "DISABLED"}**`,
      inline: false,
    },
    {
      name: "Summary",
      value: shortText(summary, 1024),
      inline: false,
    },
  ];

  if (details) {
    const benefits = details.benefits?.length ? details.benefits.map((x) => `• ${x}`).join("\n") : "-";
    const items = details.displayItems?.length ? details.displayItems.map((x) => `• ${x}`).join("\n") : "-";
    const vehicles = details.vehicleChoices?.length ? details.vehicleChoices.map((x) => `• ${x}`).join("\n") : "-";
    const boats = details.boatChoices?.length ? details.boatChoices.map((x) => `• ${x}`).join("\n") : "-";

    fields.push(
      { name: "Benefits", value: shortText(benefits, 1024), inline: false },
      { name: "Items", value: shortText(items, 1024), inline: false },
      { name: "Vehicles", value: shortText(vehicles, 1024), inline: false },
      { name: "Boats", value: shortText(boats, 1024), inline: false }
    );
  }

  return new EmbedBuilder()
    .setColor(data.is_active ? 0x1f8b4c : 0x5865f2)
    .setTitle(`📦 ${data.pack_code} — ${data.pack_name}`)
    .setDescription(data.description || "ไม่มีคำอธิบาย")
    .addFields(fields)
    .setFooter({ text: `Pack ID: ${data.pack_id}` });
}

async function rebuildShopPanel(client) {
  if (!ENV.SHOP_CHANNEL_ID) throw new Error("Missing ENV.SHOP_CHANNEL_ID");
  const ch = await client.channels.fetch(ENV.SHOP_CHANNEL_ID);
  if (!ch) throw new Error("Cannot fetch shop channel");
  const payload = await buildShopPanel();

  if (ENV.PANEL_MESSAGE_ID) {
    const oldMsg = await ch.messages.fetch(ENV.PANEL_MESSAGE_ID).catch(() => null);
    if (oldMsg) {
      await oldMsg.edit(payload);
      return oldMsg;
    }
  }

  const sent = await ch.send(payload);
  await sent.pin().catch(() => {});
  return sent;
}

function buildPackSelect(customId, packs, placeholder) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        packs.slice(0, 25).map((pack) => ({
          label: `${pack.pack_code} • ${pack.pack_name}`.slice(0, 100),
          description: `${pack.pack_type} • ${money(pack.price)} บาท • ${pack.is_active ? "ACTIVE" : "DISABLED"}`.slice(0, 100),
          value: pack.pack_id,
        }))
      )
  );
}

export async function openCreatePackModal(interaction) {
  const modal = new ModalBuilder().setCustomId("admin_pack_create_modal").setTitle("Create Pack");

  const code = new TextInputBuilder()
    .setCustomId("pack_code")
    .setLabel("Pack Code")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("เช่น GOLD หรือ VIP_BASIC");

  const name = new TextInputBuilder()
    .setCustomId("pack_name")
    .setLabel("Pack Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("ชื่อแพ็กที่จะแสดงในร้าน");

  const type = new TextInputBuilder()
    .setCustomId("pack_type")
    .setLabel("Pack Type")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue("DONATE")
    .setPlaceholder("DONATE / VIP / BOOST / EVENT");

  const price = new TextInputBuilder()
    .setCustomId("price")
    .setLabel("Price")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("เช่น 149");

  const description = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder("คำอธิบายแพ็ก");

  modal.addComponents(
    new ActionRowBuilder().addComponents(code),
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(type),
    new ActionRowBuilder().addComponents(price),
    new ActionRowBuilder().addComponents(description)
  );

  return interaction.showModal(modal);
}

export async function createPackFromModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const pack = await DonatePackRepo.createPack({
    pack_code: interaction.fields.getTextInputValue("pack_code"),
    pack_name: interaction.fields.getTextInputValue("pack_name"),
    pack_type: interaction.fields.getTextInputValue("pack_type"),
    price: interaction.fields.getTextInputValue("price"),
    description: interaction.fields.getTextInputValue("description"),
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag ?? interaction.user.username,
  });

  await AuditRepo.add({
    guildId: interaction.guildId,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag ?? interaction.user.username,
    action: "PACK_CREATE",
    target: pack.pack_code,
    meta: { pack_id: pack.pack_id, pack_name: pack.pack_name, pack_type: pack.pack_type, price: pack.price },
  });

  return interaction.editReply({
    content: `✅ สร้างแพ็กสำเร็จ: **${pack.pack_code}**`,
    embeds: [buildPackEmbed(pack)],
  });
}

export async function openEditPackPicker(interaction) {
  const packs = await DonatePackRepo.listAdminPacks(25);
  if (!packs.length) {
    return safeReply(interaction, { content: "❌ ยังไม่มีแพ็กในระบบ", ephemeral: true });
  }

  return interaction.reply({
    content: "✏️ เลือกแพ็กที่ต้องการแก้ไข",
    components: [buildPackSelect("admin:packs:edit_select", packs, "เลือกแพ็กเพื่อแก้ไข")],
    flags: MessageFlags.Ephemeral,
  });
}

export async function openPreviewPackPicker(interaction) {
  const packs = await DonatePackRepo.listAdminPacks(25);
  if (!packs.length) {
    return safeReply(interaction, { content: "❌ ยังไม่มีแพ็กในระบบ", ephemeral: true });
  }

  return interaction.reply({
    content: "👁️ เลือกแพ็กที่ต้องการดูรายละเอียด",
    components: [buildPackSelect("admin:packs:preview_select", packs, "เลือกแพ็กเพื่อดูรายละเอียด")],
    flags: MessageFlags.Ephemeral,
  });
}

export async function openTogglePackPicker(interaction) {
  const packs = await DonatePackRepo.listAdminPacks(25);
  if (!packs.length) {
    return safeReply(interaction, { content: "❌ ยังไม่มีแพ็กในระบบ", ephemeral: true });
  }

  return interaction.reply({
    content: "✅ เลือกแพ็กเพื่อสลับสถานะเปิด/ปิดขาย",
    components: [buildPackSelect("admin:packs:toggle_select", packs, "เลือกแพ็กเพื่อ Enable / Disable")],
    flags: MessageFlags.Ephemeral,
  });
}

export async function openEditPackModalFromSelect(interaction) {
  const packId = interaction.values?.[0];
  const pack = await DonatePackRepo.getPackById(packId);
  if (!pack) {
    return safeReply(interaction, { content: "❌ ไม่พบแพ็กที่เลือก", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`admin_pack_edit_modal:${pack.pack_id}`)
    .setTitle(`Edit ${pack.pack_code}`);

  const name = new TextInputBuilder()
    .setCustomId("pack_name")
    .setLabel("Pack Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(pack.pack_name || "");

  const type = new TextInputBuilder()
    .setCustomId("pack_type")
    .setLabel("Pack Type")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(pack.pack_type || "DONATE");

  const price = new TextInputBuilder()
    .setCustomId("price")
    .setLabel("Price")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(pack.price ?? 0));

  const sort = new TextInputBuilder()
    .setCustomId("sort_order")
    .setLabel("Sort Order")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(pack.sort_order ?? 0));

  const description = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setValue(pack.description || pack.panel_summary || "");

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(type),
    new ActionRowBuilder().addComponents(price),
    new ActionRowBuilder().addComponents(sort),
    new ActionRowBuilder().addComponents(description)
  );

  return interaction.showModal(modal);
}

export async function updatePackFromModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const packId = interaction.customId.split(":")[1];
  const before = await DonatePackRepo.getPackById(packId);
  if (!before) {
    return interaction.editReply("❌ ไม่พบแพ็กที่ต้องการแก้ไข");
  }

  const payload = parseEditModalFields(interaction);
  const after = await DonatePackRepo.updatePack(packId, {
    ...payload,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag ?? interaction.user.username,
  });

  await AuditRepo.add({
    guildId: interaction.guildId,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag ?? interaction.user.username,
    action: "PACK_UPDATE",
    target: after.pack_code,
    meta: {
      pack_id: after.pack_id,
      before: {
        pack_name: before.pack_name,
        pack_type: before.pack_type,
        price: before.price,
        sort_order: before.sort_order,
        description: before.description,
      },
      after: {
        pack_name: after.pack_name,
        pack_type: after.pack_type,
        price: after.price,
        sort_order: after.sort_order,
        description: after.description,
      },
    },
  });

  return interaction.editReply({
    content: `✅ แก้ไขแพ็กสำเร็จ: **${after.pack_code}**`,
    embeds: [buildPackEmbed(after)],
  });
}

export async function previewPackFromSelect(interaction) {
  const packId = interaction.values?.[0];
  const basePack = await DonatePackRepo.getPackById(packId);
  if (!basePack) {
    return safeReply(interaction, { content: "❌ ไม่พบแพ็กที่เลือก", ephemeral: true });
  }

  const details = await DonatePackRepo.getPackDetails(basePack.pack_code);
  return interaction.reply({
    embeds: [buildPackEmbed(basePack, details)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function togglePackFromSelect(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const packId = interaction.values?.[0];
  const before = await DonatePackRepo.getPackById(packId);
  if (!before) {
    return interaction.editReply("❌ ไม่พบแพ็กที่เลือก");
  }

  const after = await DonatePackRepo.togglePack(
    packId,
    !before.is_active,
    interaction.user.tag ?? interaction.user.username
  );

  await AuditRepo.add({
    guildId: interaction.guildId,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag ?? interaction.user.username,
    action: after.is_active ? "PACK_ENABLE" : "PACK_DISABLE",
    target: after.pack_code,
    meta: { pack_id: after.pack_id, from: before.is_active, to: after.is_active },
  });

  return interaction.editReply({
    content: `✅ ${after.is_active ? "เปิดขาย" : "ปิดขาย"}แพ็กแล้ว: **${after.pack_code}**`,
    embeds: [buildPackEmbed(after)],
  });
}

export async function refreshShopPanelFromAdmin(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const sent = await rebuildShopPanel(interaction.client);

  await AuditRepo.add({
    guildId: interaction.guildId,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag ?? interaction.user.username,
    action: "PACK_REFRESH_SHOP_PANEL",
    target: sent.id,
    meta: { shop_channel_id: ENV.SHOP_CHANNEL_ID, message_id: sent.id },
  });

  return interaction.editReply(`✅ Refresh Shop Panel แล้ว\nMessage ID: ${sent.id}\nChannel: <#${ENV.SHOP_CHANNEL_ID}>`);
}
