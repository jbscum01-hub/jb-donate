import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
    contents: "เลือกแพ็กที่ต้องการแก้เนื้อหา",
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

function formatBenefitsForEditor(details) {
  const rows = details?.benefitRows || [];
  if (!rows.length) return "สิทธิ์ข้อ 1\nสิทธิ์ข้อ 2";
  return rows.map((row) => row.sort_order ? `${row.benefit_text} | ${row.sort_order}` : row.benefit_text).join("\n");
}

function formatItemsForEditor(details) {
  const rows = details?.items || [];
  if (!rows.length) return "Rags | 60 | RAGS | Rag_Strips | #spawnitem Rag_Strips 60 | MEDIC | 10";
  return rows.map((row) => [
    row.item_name || "",
    row.quantity ?? 1,
    row.item_code || "",
    row.item_spawn_name || "",
    row.item_spawn_command_template || "",
    row.item_group || "",
    row.sort_order ?? "",
  ].join(" | ")).join("\n");
}

function formatVehiclesForEditor(details) {
  const rows = details?.vehicleRows || [];
  if (!rows.length) return "Wolfswagen | Wolfswagen | CAR | 3 | 30 | WOLFS | #spawnvehicle Wolfswagen | 10";
  return rows.map((row) => [
    row.vehicle_name || "",
    row.vehicle_model || "",
    row.vehicle_kind || "CAR",
    row.insurance_total ?? 0,
    row.insurance_days ?? 0,
    row.vehicle_code || "",
    row.spawn_command_template || "",
    row.sort_order ?? "",
  ].join(" | ")).join("\n");
}

function formatBoatsForEditor(details) {
  const rows = details?.boatRows || [];
  if (!rows.length) return "Fishing Boat | Fishing_Boat | 2 | 30 | BOAT001 | #spawnvehicle Fishing_Boat | 10";
  return rows.map((row) => [
    row.boat_name || "",
    row.boat_model || "",
    row.insurance_total ?? 0,
    row.insurance_days ?? 0,
    row.boat_code || "",
    row.spawn_command_template || "",
    row.sort_order ?? "",
  ].join(" | ")).join("\n");
}

function buildContentButtons(packId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`admin:packs:contents:benefits:${packId}`).setLabel("Benefits").setEmoji("🎁").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:contents:items:${packId}`).setLabel("Items").setEmoji("📦").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:contents:vehicles:${packId}`).setLabel("Vehicles").setEmoji("🚗").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:contents:boats:${packId}`).setLabel("Boats").setEmoji("🛥️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:contents:preview:${packId}`).setLabel("Refresh Preview").setEmoji("👁️").setStyle(ButtonStyle.Primary),
    ),
  ];
}

function contentsHelpEmbed(pack, details) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🧩 Edit Pack Contents: ${pack.pack_code}`)
    .setDescription("แก้เนื้อหาแพ็กผ่าน modal ได้เลย\n\n**รูปแบบข้อมูล**\n• Benefits: `ข้อความ | sort`\n• Items: `ชื่อ | qty | code | spawn_name | command | group | sort`\n• Vehicles: `ชื่อ | model | kind | ins_total | ins_days | code | command | sort`\n• Boats: `ชื่อ | model | ins_total | ins_days | code | command | sort`\n\nลบบรรทัดทั้งหมด = ล้างข้อมูลส่วนนั้น")
    .addFields(
      { name: "Benefits", value: String(details?.benefits?.length || 0), inline: true },
      { name: "Items", value: String(details?.items?.length || 0), inline: true },
      { name: "Vehicles", value: String(details?.vehicleRows?.length || 0), inline: true },
      { name: "Boats", value: String(details?.boatRows?.length || 0), inline: true },
    )
    .setFooter({ text: `Pack ID: ${pack.pack_id}` });
}

function buildContentsModal(kind, pack, details) {
  const modal = new ModalBuilder()
    .setCustomId(`admin:packs:modal:contents:${kind}:${pack.pack_id}`)
    .setTitle(`${pack.pack_code} • ${kind}`.slice(0, 45));

  const titleMap = {
    benefits: "Benefits",
    items: "Items",
    vehicles: "Vehicles",
    boats: "Boats",
  };

  const placeholderMap = {
    benefits: "หนึ่งสิทธิ์ต่อหนึ่งบรรทัด | sort",
    items: "ชื่อ | qty | code | spawn_name | command | group | sort",
    vehicles: "ชื่อ | model | kind | ins_total | ins_days | code | command | sort",
    boats: "ชื่อ | model | ins_total | ins_days | code | command | sort",
  };

  const valueMap = {
    benefits: formatBenefitsForEditor(details),
    items: formatItemsForEditor(details),
    vehicles: formatVehiclesForEditor(details),
    boats: formatBoatsForEditor(details),
  };

  const input = new TextInputBuilder()
    .setCustomId("content_lines")
    .setLabel(titleMap[kind] || "Contents")
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(placeholderMap[kind] || "หนึ่งบรรทัดต่อหนึ่งรายการ")
    .setValue(String(valueMap[kind] || "").slice(0, 4000));

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function splitNonEmptyLines(raw) {
  return String(raw || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function parseBenefitsLines(raw) {
  return splitNonEmptyLines(raw).map((line, idx) => {
    const parts = line.split("|").map((x) => x.trim());
    return {
      benefit_text: parts[0],
      sort_order: parseSortOrder(parts[1], (idx + 1) * 10),
    };
  }).filter((x) => x.benefit_text);
}

function parseItemsLines(raw) {
  return splitNonEmptyLines(raw).map((line, idx) => {
    const parts = line.split("|").map((x) => x.trim());
    const qty = Number(parts[1] || 1);
    const sort = parseSortOrder(parts[6], (idx + 1) * 10);
    if (!parts[0]) throw new Error(`Items บรรทัด ${idx + 1} ต้องมีชื่อ item`);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Items บรรทัด ${idx + 1} qty ไม่ถูกต้อง`);
    if (sort == null) throw new Error(`Items บรรทัด ${idx + 1} sort ไม่ถูกต้อง`);
    return {
      item_name: parts[0],
      quantity: Math.floor(qty),
      item_code: trimOrNull(parts[2]),
      item_spawn_name: trimOrNull(parts[3]),
      item_spawn_command_template: trimOrNull(parts[4]),
      item_group: trimOrNull(parts[5]),
      sort_order: sort,
    };
  });
}

function parseVehiclesLines(raw) {
  return splitNonEmptyLines(raw).map((line, idx) => {
    const parts = line.split("|").map((x) => x.trim());
    const total = Number(parts[3] || 0);
    const days = Number(parts[4] || 0);
    const sort = parseSortOrder(parts[7], (idx + 1) * 10);
    const kind = String(parts[2] || "CAR").toUpperCase();
    if (!parts[0] || !parts[1]) throw new Error(`Vehicles บรรทัด ${idx + 1} ต้องมีชื่อและ model`);
    if (!["CAR", "BIKE", "AIR"].includes(kind)) throw new Error(`Vehicles บรรทัด ${idx + 1} kind ต้องเป็น CAR/BIKE/AIR`);
    if (!Number.isFinite(total) || total < 0 || !Number.isFinite(days) || days < 0) throw new Error(`Vehicles บรรทัด ${idx + 1} insurance ไม่ถูกต้อง`);
    if (sort == null) throw new Error(`Vehicles บรรทัด ${idx + 1} sort ไม่ถูกต้อง`);
    return {
      vehicle_name: parts[0],
      vehicle_model: parts[1],
      vehicle_kind: kind,
      insurance_total: Math.floor(total),
      insurance_days: Math.floor(days),
      vehicle_code: trimOrNull(parts[5]),
      spawn_command_template: trimOrNull(parts[6]),
      sort_order: sort,
    };
  });
}

function parseBoatsLines(raw) {
  return splitNonEmptyLines(raw).map((line, idx) => {
    const parts = line.split("|").map((x) => x.trim());
    const total = Number(parts[2] || 0);
    const days = Number(parts[3] || 0);
    const sort = parseSortOrder(parts[6], (idx + 1) * 10);
    if (!parts[0] || !parts[1]) throw new Error(`Boats บรรทัด ${idx + 1} ต้องมีชื่อและ model`);
    if (!Number.isFinite(total) || total < 0 || !Number.isFinite(days) || days < 0) throw new Error(`Boats บรรทัด ${idx + 1} insurance ไม่ถูกต้อง`);
    if (sort == null) throw new Error(`Boats บรรทัด ${idx + 1} sort ไม่ถูกต้อง`);
    return {
      boat_name: parts[0],
      boat_model: parts[1],
      insurance_total: Math.floor(total),
      insurance_days: Math.floor(days),
      boat_code: trimOrNull(parts[4]),
      spawn_command_template: trimOrNull(parts[5]),
      sort_order: sort,
    };
  });
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

  if (id === "admin:packs:edit_contents") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    return replyWithPackSelector(interaction, "contents");
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

  if (id.startsWith("admin:packs:contents:")) {
    const [, , , kind, packId] = id.split(":");
    if (kind === "preview") {
      const details = await DonatePackRepo.getPackDetailsById(packId);
      if (!details) {
        return interaction.reply({ content: "❌ ไม่พบแพ็กนี้ในระบบ", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return interaction.update({
        content: null,
        embeds: [previewEmbed(details, details), contentsHelpEmbed(details, details)],
        components: buildContentButtons(packId),
      }).catch(() => {});
    }

    const details = await DonatePackRepo.getPackDetailsById(packId);
    if (!details) {
      return interaction.reply({ content: "❌ ไม่พบแพ็กนี้ในระบบ", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return interaction.showModal(buildContentsModal(kind, details, details));
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

  if (mode === "contents") {
    const details = await DonatePackRepo.getPackDetailsById(pack.pack_id);
    await interaction.update({
      content: null,
      embeds: [previewEmbed(pack, details), contentsHelpEmbed(pack, details)],
      components: buildContentButtons(pack.pack_id),
    }).catch(() => {});
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

  if (id.startsWith("admin:packs:modal:contents:")) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const [, , , , kind, packId] = id.split(":");
    const current = await DonatePackRepo.getPackDetailsById(packId);
    if (!current) {
      await interaction.editReply("❌ ไม่พบแพ็กนี้ในระบบ").catch(() => {});
      return true;
    }

    const raw = interaction.fields.getTextInputValue("content_lines");
    let savedCount = 0;
    try {
      if (kind === "benefits") {
        const benefits = parseBenefitsLines(raw);
        await DonatePackRepo.replaceBenefits(packId, benefits, actorTag(interaction.user));
        savedCount = benefits.length;
      } else if (kind === "items") {
        const items = parseItemsLines(raw);
        await DonatePackRepo.replaceItems(packId, items, actorTag(interaction.user));
        savedCount = items.length;
      } else if (kind === "vehicles") {
        const vehicles = parseVehiclesLines(raw);
        await DonatePackRepo.replaceVehicles(packId, vehicles, actorTag(interaction.user));
        savedCount = vehicles.length;
      } else if (kind === "boats") {
        const boats = parseBoatsLines(raw);
        await DonatePackRepo.replaceBoats(packId, boats, actorTag(interaction.user));
        savedCount = boats.length;
      } else {
        throw new Error("ชนิดข้อมูลไม่ถูกต้อง");
      }
    } catch (err) {
      await interaction.editReply(`❌ ${err.message || String(err)}`).catch(() => {});
      return true;
    }

    const updated = await DonatePackRepo.getPackDetailsById(packId);
    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: actorTag(interaction.user),
      action: `PACK_CONTENT_${String(kind).toUpperCase()}`,
      target: updated?.pack_code || current.pack_code,
      meta: { pack_id: packId, kind, saved_count: savedCount },
    }).catch(() => {});

    await interaction.editReply({
      content: `✅ บันทึก ${kind} ของแพ็ก ${updated?.pack_code || current.pack_code} แล้ว (${savedCount} รายการ)`,
      embeds: [previewEmbed(updated, updated), contentsHelpEmbed(updated, updated)],
      components: buildContentButtons(packId),
    }).catch(() => {});
    return true;
  }

  return false;
}
