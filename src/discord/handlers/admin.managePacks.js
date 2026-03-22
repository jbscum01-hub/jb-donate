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

function actorTag(user) {
  return user?.tag || user?.username || "unknown";
}

function money(v) {
  return Number(v || 0).toLocaleString("th-TH");
}

function safeType(v) {
  return String(v || "DONATE").trim().toUpperCase();
}

function trimOrNull(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function parsePrice(v) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseSortOrder(v, fallback = 0) {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function previewEmbed(pack, details = null) {
  const d = details || pack;
  const lines = [];
  if (d.description) lines.push(d.description);
  if (d.summary_lines?.length) lines.push("", ...d.summary_lines.map((x) => `• ${x}`));

  const fields = [
    { name: "Code", value: `\`${d.pack_code}\``, inline: true },
    { name: "Type", value: d.pack_type || "DONATE", inline: true },
    { name: "Status", value: d.is_active ? "✅ Active" : "⛔ Disabled", inline: true },
    { name: "Price", value: `${money(d.price)} บาท`, inline: true },
    { name: "Sort", value: String(d.sort_order ?? 0), inline: true },
  ];

  if (d.displayItems?.length) {
    fields.push({
      name: "Items",
      value: d.displayItems.slice(0, 10).map((x) => `• ${x}`).join("\n").slice(0, 1024),
      inline: false,
    });
  }

  if (d.vehicleChoices?.length) {
    fields.push({
      name: "Vehicle Choices",
      value: d.vehicleChoices.slice(0, 10).map((x) => `• ${x}`).join("\n").slice(0, 1024),
      inline: false,
    });
  }

  if (d.boatChoices?.length) {
    fields.push({
      name: "Boat Choices",
      value: d.boatChoices.slice(0, 10).map((x) => `• ${x}`).join("\n").slice(0, 1024),
      inline: false,
    });
  }

  if (d.benefits?.length) {
    fields.push({
      name: "Benefits",
      value: d.benefits.slice(0, 10).map((x) => `• ${x}`).join("\n").slice(0, 1024),
      inline: false,
    });
  }

  return new EmbedBuilder()
    .setColor(d.is_active ? 0x1f8b4c : 0x5865f2)
    .setTitle(`📦 ${d.pack_name}`)
    .setDescription(lines.join("\n").slice(0, 4096) || "-")
    .addFields(fields)
    .setFooter({ text: `Pack ID: ${d.pack_id}` });
}

async function replyWithPackSelector(interaction, mode) {
  const packs = await DonatePackRepo.listAdminPacks(25);
  if (!packs.length) {
    return interaction.editReply("❌ ยังไม่มีแพ็กในระบบ");
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`admin:packs:select:${mode}`)
    .setPlaceholder("เลือกแพ็ก")
    .addOptions(
      packs.slice(0, 25).map((pack) => ({
        label: `${pack.pack_code} • ${pack.pack_name}`.slice(0, 100),
        description: `${pack.is_active ? "ACTIVE" : "DISABLED"} • ${money(pack.price)} บาท • ${pack.pack_type}`.slice(0, 100),
        value: pack.pack_id,
      }))
    );

  const titles = {
    edit: "เลือกแพ็กที่ต้องการแก้ไข",
    preview: "เลือกแพ็กที่ต้องการดูรายละเอียด",
    toggle: "เลือกแพ็กที่ต้องการเปิด/ปิด",
  };

  return interaction.editReply({
    content: `📦 ${titles[mode] || "เลือกแพ็ก"}`,
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

function buildCreateModal() {
  const modal = new ModalBuilder()
    .setCustomId("admin:packs:modal:create")
    .setTitle("Create Donate Pack");

  const code = new TextInputBuilder()
    .setCustomId("pack_code")
    .setLabel("Pack Code")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("เช่น BRONZE");

  const name = new TextInputBuilder()
    .setCustomId("pack_name")
    .setLabel("Pack Name")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("เช่น Bronze Package");

  const type = new TextInputBuilder()
    .setCustomId("pack_type")
    .setLabel("Pack Type (DONATE/VIP/BOOST/EVENT)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue("DONATE");

  const price = new TextInputBuilder()
    .setCustomId("price")
    .setLabel("Price")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("เช่น 199");

  const desc = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("รายละเอียดแพ็ก");

  modal.addComponents(
    new ActionRowBuilder().addComponents(code),
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(type),
    new ActionRowBuilder().addComponents(price),
    new ActionRowBuilder().addComponents(desc)
  );

  return modal;
}

function buildEditModal(pack) {
  const modal = new ModalBuilder()
    .setCustomId(`admin:packs:modal:edit:${pack.pack_id}`)
    .setTitle(`Edit ${pack.pack_code}`);

  const code = new TextInputBuilder()
    .setCustomId("pack_code")
    .setLabel("Pack Code")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(String(pack.pack_code || "").slice(0, 100));

  const name = new TextInputBuilder()
    .setCustomId("pack_name")
    .setLabel("Pack Name")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(String(pack.pack_name || "").slice(0, 100));

  const type = new TextInputBuilder()
    .setCustomId("pack_type")
    .setLabel("Pack Type (DONATE/VIP/BOOST/EVENT)")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(String(pack.pack_type || "DONATE").slice(0, 100));

  const price = new TextInputBuilder()
    .setCustomId("price")
    .setLabel("Price")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setValue(String(pack.price ?? 0));

  const summary = new TextInputBuilder()
    .setCustomId("summary")
    .setLabel("Summary + Sort")
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("บรรทัดสุดท้ายใส่ sort=10")
    .setValue(`${pack.panel_summary || pack.description || ""}${pack.sort_order != null ? `\nsort=${pack.sort_order}` : ""}`.slice(0, 4000));

  modal.addComponents(
    new ActionRowBuilder().addComponents(code),
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(type),
    new ActionRowBuilder().addComponents(price),
    new ActionRowBuilder().addComponents(summary)
  );

  return modal;
}

function parseSummaryAndSort(raw, fallbackSort = 0) {
  const lines = String(raw || "").split(/\r?\n/);
  let sort = fallbackSort;
  const kept = [];
  for (const line of lines) {
    const m = line.trim().match(/^sort\s*=\s*(\d+)$/i);
    if (m) {
      sort = Number(m[1]);
      continue;
    }
    kept.push(line);
  }
  return {
    panel_summary: trimOrNull(kept.join("\n")),
    sort_order: sort,
  };
}

export async function handleManagePacksButton(interaction, { refreshShopPanel } = {}) {
  const id = interaction.customId;

  if (id === "admin:packs:create") {
    return interaction.showModal(buildCreateModal());
  }

  if (id === "admin:packs:edit") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    return replyWithPackSelector(interaction, "edit");
  }

  if (id === "admin:packs:preview") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    return replyWithPackSelector(interaction, "preview");
  }

  if (id === "admin:packs:toggle") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    return replyWithPackSelector(interaction, "toggle");
  }

  if (id === "admin:packs:refresh") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const msg = await refreshShopPanel();
    return interaction.editReply(`✅ Refresh Shop Panel แล้ว\nMessage ID: ${msg.id}`);
  }
}

export async function handleManagePacksSelect(interaction) {
  const id = interaction.customId;
  if (!id.startsWith("admin:packs:select:")) return false;

  const mode = id.split(":")[3];
  const packId = interaction.values?.[0];
  if (!packId) {
    await interaction.reply({ content: "❌ ไม่พบแพ็กที่เลือก", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const pack = await DonatePackRepo.getPackById(packId);
  if (!pack) {
    await interaction.reply({ content: "❌ ไม่พบแพ็กนี้ในระบบ", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  if (mode === "edit") {
    await interaction.showModal(buildEditModal(pack));
    return true;
  }

  if (mode === "preview") {
    const details = await DonatePackRepo.getPackDetails(pack.pack_code);
    await interaction.update({
      content: null,
      embeds: [previewEmbed(pack, details)],
      components: [],
    }).catch(() => {});
    return true;
  }

  if (mode === "toggle") {
    const updated = await DonatePackRepo.togglePack(pack.pack_id, actorTag(interaction.user));
    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: actorTag(interaction.user),
      action: updated?.is_active ? "PACK_ENABLE" : "PACK_DISABLE",
      target: updated?.pack_code || pack.pack_code,
      meta: {
        pack_id: updated?.pack_id || pack.pack_id,
        is_active: updated?.is_active,
      },
    }).catch(() => {});

    await interaction.update({
      content: `✅ ${updated?.pack_code || pack.pack_code} ถูก${updated?.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}แล้ว`,
      embeds: [],
      components: [],
    }).catch(() => {});
    return true;
  }

  return false;
}

export async function handleManagePacksModal(interaction) {
  const id = interaction.customId;
  if (id === "admin:packs:modal:create") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    const pack_code = interaction.fields.getTextInputValue("pack_code").trim().toUpperCase();
    const pack_name = interaction.fields.getTextInputValue("pack_name").trim();
    const pack_type = safeType(interaction.fields.getTextInputValue("pack_type"));
    const price = parsePrice(interaction.fields.getTextInputValue("price"));
    const description = trimOrNull(interaction.fields.getTextInputValue("description"));

    if (!pack_code || !pack_name) {
      await interaction.editReply("❌ กรุณากรอก Pack Code และ Pack Name").catch(() => {});
      return true;
    }
    if (price == null) {
      await interaction.editReply("❌ Price ต้องเป็นตัวเลข 0 ขึ้นไป").catch(() => {});
      return true;
    }

    const existing = await DonatePackRepo.getPackByCode(pack_code);
    if (existing) {
      await interaction.editReply(`❌ มี Pack Code นี้อยู่แล้ว: ${pack_code}`).catch(() => {});
      return true;
    }

    const sort_order = await DonatePackRepo.getNextSortOrder();
    const created = await DonatePackRepo.createPack({
      pack_code,
      pack_name,
      pack_type,
      price,
      description,
      panel_summary: description,
      sort_order,
      created_by: actorTag(interaction.user),
      updated_by: actorTag(interaction.user),
    });

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: actorTag(interaction.user),
      action: "PACK_CREATE",
      target: created?.pack_code || pack_code,
      meta: {
        pack_id: created?.pack_id,
        pack_type,
        price,
        sort_order,
      },
    }).catch(() => {});

    await interaction.editReply({
      content: `✅ สร้างแพ็ก ${created.pack_code} เรียบร้อยแล้ว`,
      embeds: [previewEmbed(created)],
    }).catch(() => {});
    return true;
  }

  if (id.startsWith("admin:packs:modal:edit:")) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    const packId = id.split(":")[4];
    const current = await DonatePackRepo.getPackById(packId);
    if (!current) {
      await interaction.editReply("❌ ไม่พบแพ็กนี้ในระบบ").catch(() => {});
      return true;
    }

    const pack_code = interaction.fields.getTextInputValue("pack_code").trim().toUpperCase();
    const pack_name = interaction.fields.getTextInputValue("pack_name").trim();
    const pack_type = safeType(interaction.fields.getTextInputValue("pack_type"));
    const price = parsePrice(interaction.fields.getTextInputValue("price"));
    const summaryRaw = interaction.fields.getTextInputValue("summary");
    const parsed = parseSummaryAndSort(summaryRaw, current.sort_order ?? 0);

    if (!pack_code || !pack_name) {
      await interaction.editReply("❌ กรุณากรอก Pack Code และ Pack Name").catch(() => {});
      return true;
    }
    if (price == null) {
      await interaction.editReply("❌ Price ต้องเป็นตัวเลข 0 ขึ้นไป").catch(() => {});
      return true;
    }

    const dup = await DonatePackRepo.getPackByCode(pack_code);
    if (dup && dup.pack_id !== current.pack_id) {
      await interaction.editReply(`❌ Pack Code ซ้ำกับ ${dup.pack_code}`).catch(() => {});
      return true;
    }

    const updated = await DonatePackRepo.updatePack(packId, {
      pack_code,
      pack_name,
      pack_type,
      price,
      description: current.description,
      panel_summary: parsed.panel_summary,
      sort_order: parsed.sort_order,
      updated_by: actorTag(interaction.user),
    });

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: actorTag(interaction.user),
      action: "PACK_UPDATE",
      target: updated?.pack_code || pack_code,
      meta: {
        pack_id: packId,
        before: {
          pack_code: current.pack_code,
          pack_name: current.pack_name,
          pack_type: current.pack_type,
          price: current.price,
          panel_summary: current.panel_summary,
          sort_order: current.sort_order,
        },
        after: {
          pack_code,
          pack_name,
          pack_type,
          price,
          panel_summary: parsed.panel_summary,
          sort_order: parsed.sort_order,
        },
      },
    }).catch(() => {});

    await interaction.editReply({
      content: `✅ แก้ไขแพ็ก ${updated.pack_code} เรียบร้อยแล้ว`,
      embeds: [previewEmbed(updated)],
    }).catch(() => {});
    return true;
  }

  return false;
}
