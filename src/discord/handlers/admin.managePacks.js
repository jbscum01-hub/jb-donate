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
import { buildShopPanel } from "../panels/shopPanel.js";
import { ENV } from "../../config/env.js";
import { safeReply } from "../utils/messages.js";

const PACK_TYPES = ["DONATE", "VIP", "BOOST", "EVENT"];
const PAGE_SIZE = 10;

function money(n) {
  return `${Number(n || 0).toLocaleString("th-TH")}`;
}

function yn(v) {
  return v ? "🟢 Active" : "🔴 Inactive";
}

function normalizePackCode(v) {
  return String(v || "").trim().toUpperCase();
}

function parseTextBool(v, fallback = true) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (["true", "1", "yes", "y", "on", "active"].includes(s)) return true;
  if (["false", "0", "no", "n", "off", "inactive"].includes(s)) return false;
  throw new Error("is_active ต้องเป็น true หรือ false");
}

function parseIntStrict(v, label) {
  const n = Number(String(v ?? "").trim());
  if (!Number.isInteger(n)) throw new Error(`${label} ต้องเป็นจำนวนเต็ม`);
  return n;
}

function truncate(s, max = 100) {
  const text = String(s || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function mainMenuEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📦 Manage Packs")
    .setDescription(
      [
        "เมนูจัดการ Donate Packs",
        "",
        "• View Packs",
        "• Add Pack",
        "• Edit Pack",
        "• Toggle Pack Active",
        "• Delete Pack (Safe)",
        "• Sync Pack Panel",
      ].join("\n")
    )
    .setFooter({ text: "เลือก pack ก่อน แล้วค่อยเลือก action" });
}

function mainMenuComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("admin:packs:view:1").setLabel("View Packs").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("admin:packs:add").setLabel("Add Pack").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("admin:packs:edit").setLabel("Edit Pack").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("admin:packs:preview").setLabel("Preview Pack").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("admin:packs:toggle").setLabel("Toggle Active").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("admin:packs:delete").setLabel("Delete Pack").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("admin:packs:refresh").setLabel("Sync Pack Panel").setStyle(ButtonStyle.Primary),
    ),
  ];
}

function buildPackListEmbed(data) {
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / data.limit));
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("📦 Pack List")
    .setFooter({ text: `Page ${data.page}/${totalPages} • Total ${data.total}` });

  if (!data.rows.length) {
    embed.setDescription("ยังไม่มี pack ในระบบ");
    return embed;
  }

  embed.setDescription(
    data.rows
      .map(
        (pack) =>
          `**${pack.sort_order}. ${pack.pack_name}**\n\`${pack.pack_code}\` • ${pack.pack_type} • ${money(pack.price)} บาท\n${yn(pack.is_active)}`
      )
      .join("\n\n")
  );
  return embed;
}

function buildPackListComponents(data) {
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / data.limit));
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:packs:view:${Math.max(1, data.page - 1)}`)
        .setLabel("◀ Prev")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(data.page <= 1),
      new ButtonBuilder()
        .setCustomId(`admin:packs:view:${Math.min(totalPages, data.page + 1)}`)
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(data.page >= totalPages),
      new ButtonBuilder().setCustomId("admin:packs:menu").setLabel("Back").setStyle(ButtonStyle.Primary)
    ),
  ];

  if (data.rows.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("admin:packs:select:view")
          .setPlaceholder("เลือก pack เพื่อดูรายละเอียด")
          .addOptions(
            data.rows.slice(0, 25).map((pack) => ({
              label: truncate(pack.pack_name, 100),
              description: truncate(`${pack.pack_code} • ${pack.pack_type} • ${pack.is_active ? "Active" : "Inactive"}`, 100),
              value: pack.pack_id,
            }))
          )
      )
    );
  }

  return rows;
}

function buildPackDetailEmbed(pack, mode = "detail") {
  const embed = new EmbedBuilder()
    .setColor(pack.is_active ? 0x57f287 : 0xed4245)
    .setTitle(`${mode === "preview" ? "👁️ Preview Pack" : "📦 Pack Detail"} • ${pack.pack_name}`)
    .addFields(
      { name: "Code", value: `\`${pack.pack_code}\``, inline: true },
      { name: "Type", value: pack.pack_type || "-", inline: true },
      { name: "Status", value: yn(pack.is_active), inline: true },
      { name: "Price", value: `${money(pack.price)} บาท`, inline: true },
      { name: "Sort", value: String(pack.sort_order ?? 0), inline: true },
      { name: "Image", value: pack.image_url || "-", inline: false },
      { name: "Summary", value: truncate(pack.panel_summary || pack.description || "-", 1024), inline: false },
      { name: "Description", value: truncate(pack.description || "-", 1024), inline: false },
    )
    .setFooter({ text: `Pack ID: ${pack.pack_id}` });

  if (pack.image_url) embed.setThumbnail(pack.image_url);
  return embed;
}

function buildSelectRow(customId, packs, placeholder) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        packs.slice(0, 25).map((pack) => ({
          label: truncate(pack.pack_name, 100),
          description: truncate(`${pack.pack_code} • ${pack.pack_type} • ${pack.is_active ? "Active" : "Inactive"}`, 100),
          value: pack.pack_id,
        }))
      )
  );
}

function buildEditFieldComponents(packId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:pack_name`).setLabel("Edit Name").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:description`).setLabel("Edit Description").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:price`).setLabel("Edit Price").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:pack_type`).setLabel("Edit Type").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:sort_order`).setLabel("Edit Sort").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:panel_summary`).setLabel("Edit Summary").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:image_url`).setLabel("Edit Image").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`admin:packs:edit_field:${packId}:embed_color`).setLabel("Edit Color").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("admin:packs:menu").setLabel("Back").setStyle(ButtonStyle.Primary)
    ),
  ];
}

function addPackModal() {
  const modal = new ModalBuilder().setCustomId("admin:packs:modal_add").setTitle("Add Donate Pack");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("pack_code").setLabel("pack_code").setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("pack_name").setLabel("pack_name").setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("pack_type").setLabel("pack_type (DONATE/VIP/BOOST/EVENT)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("DONATE")
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("price").setLabel("price").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("199")
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("sort_order").setLabel("sort_order").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("1")
    )
  );

  return modal;
}

function addPackDetailsModal(packId) {
  const modal = new ModalBuilder().setCustomId(`admin:packs:modal_add_details:${packId}`).setTitle("Add Pack Details");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("description").setLabel("description").setStyle(TextInputStyle.Paragraph).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("panel_summary").setLabel("panel_summary").setStyle(TextInputStyle.Paragraph).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("image_url").setLabel("image_url").setStyle(TextInputStyle.Short).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("embed_color").setLabel("embed_color (number or hex เช่น 16766720 / FFAA00)").setStyle(TextInputStyle.Short).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("is_active").setLabel("is_active (true/false)").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("true")
    )
  );

  return modal;
}

function editFieldModal(packId, field, currentValue = "") {
  const modal = new ModalBuilder().setCustomId(`admin:packs:modal_edit_field:${packId}:${field}`).setTitle(`Edit ${field}`);
  const isLong = ["description", "panel_summary"].includes(field);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("value")
        .setLabel(field)
        .setStyle(isLong ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(false)
        .setValue(String(currentValue ?? "").slice(0, 4000))
    )
  );
  return modal;
}

function normalizeColorInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^0x/i.test(raw)) return Number(raw);
  if (/^[0-9]+$/.test(raw)) return Number(raw);
  if (/^[A-Fa-f0-9]{6}$/.test(raw)) return parseInt(raw, 16);
  throw new Error("embed_color ต้องเป็นเลข หรือ hex 6 หลัก");
}

function sanitizePackCreate(fields) {
  const pack_code = normalizePackCode(fields.pack_code);
  if (!pack_code) throw new Error("pack_code ห้ามว่าง");

  const pack_name = String(fields.pack_name || "").trim();
  if (!pack_name) throw new Error("pack_name ห้ามว่าง");

  const pack_type = String(fields.pack_type || "").trim().toUpperCase();
  if (!PACK_TYPES.includes(pack_type)) {
    throw new Error(`pack_type ต้องเป็น ${PACK_TYPES.join(", ")}`);
  }

  const price = parseIntStrict(fields.price, "price");
  if (price < 0) throw new Error("price ต้องมากกว่าหรือเท่ากับ 0");

  const sort_order = parseIntStrict(fields.sort_order, "sort_order");

  return {
    pack_code,
    pack_name,
    pack_type,
    price,
    sort_order,
  };
}

function sanitizeUpdateField(field, rawValue) {
  const value = String(rawValue ?? "");

  switch (field) {
    case "pack_name": {
      const x = value.trim();
      if (!x) throw new Error("pack_name ห้ามว่าง");
      return x;
    }
    case "description":
    case "panel_summary":
    case "image_url":
      return value.trim() || null;
    case "price": {
      const x = parseIntStrict(value, "price");
      if (x < 0) throw new Error("price ต้องมากกว่าหรือเท่ากับ 0");
      return x;
    }
    case "pack_type": {
      const x = value.trim().toUpperCase();
      if (!PACK_TYPES.includes(x)) throw new Error(`pack_type ต้องเป็น ${PACK_TYPES.join(", ")}`);
      return x;
    }
    case "sort_order":
      return parseIntStrict(value, "sort_order");
    case "embed_color":
      return normalizeColorInput(value);
    default:
      throw new Error("field นี้ยังไม่รองรับ");
  }
}

async function syncShopPanel(client) {
  if (!ENV.SHOP_CHANNEL_ID) throw new Error("Missing SHOP_CHANNEL_ID");

  const channel = await client.channels.fetch(ENV.SHOP_CHANNEL_ID).catch(() => null);
  if (!channel) throw new Error("Cannot fetch shop channel");

  const payload = await buildShopPanel();
  const existingId = process.env.PANEL_MESSAGE_ID || "";

  if (existingId) {
    const msg = await channel.messages.fetch(existingId).catch(() => null);
    if (msg) {
      await msg.edit(payload);
      return { mode: "EDIT", messageId: msg.id };
    }
  }

  const sent = await channel.send(payload);
  await sent.pin().catch(() => {});
  return { mode: "CREATE", messageId: sent.id };
}

async function logPackAction(interaction, action, target, meta = null) {
  await AuditRepo.add({
    guildId: interaction.guildId,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag ?? interaction.user.username,
    action,
    target,
    meta,
  });
}

async function replyOrUpdate(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  if (typeof interaction.update === "function") {
    return interaction.update(payload);
  }
  return interaction.reply(payload);
}

export async function handleManagePacksButton(interaction) {
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  if (!id.startsWith("admin:packs:")) return false;

  if (id === "admin:packs:menu") {
    await interaction.reply({ embeds: [mainMenuEmbed()], components: mainMenuComponents(), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (id.startsWith("admin:packs:view:")) {
    const page = Number(id.split(":")[3] || 1);
    const data = await DonatePackRepo.listManagePacks({ page, limit: PAGE_SIZE, includeInactive: true });
    await interaction.reply({ embeds: [buildPackListEmbed(data)], components: buildPackListComponents(data), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (id === "admin:packs:add" || id === "admin:packs:create") {
    await interaction.showModal(addPackModal());
    return true;
  }

  if (id === "admin:packs:edit") {
    const packs = await DonatePackRepo.listAllManagePacks();
    await interaction.reply({
      content: packs.length ? "เลือก pack ที่ต้องการแก้ไข" : "ยังไม่มี pack ให้แก้ไข",
      components: packs.length ? [buildSelectRow("admin:packs:select:edit", packs, "เลือก pack เพื่อแก้ไข")] : [],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (id === "admin:packs:preview") {
    const packs = await DonatePackRepo.listAllManagePacks();
    await interaction.reply({
      content: packs.length ? "เลือก pack ที่ต้องการ preview" : "ยังไม่มี pack ให้ preview",
      components: packs.length ? [buildSelectRow("admin:packs:select:preview", packs, "เลือก pack เพื่อ preview")] : [],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (id === "admin:packs:toggle") {
    const packs = await DonatePackRepo.listAllManagePacks();
    await interaction.reply({
      content: packs.length ? "เลือก pack ที่ต้องการเปิด/ปิดการขาย" : "ยังไม่มี pack ให้ toggle",
      components: packs.length ? [buildSelectRow("admin:packs:select:toggle", packs, "เลือก pack เพื่อ toggle active")] : [],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (id === "admin:packs:delete") {
    const packs = await DonatePackRepo.listAllManagePacks();
    await interaction.reply({
      content: packs.length ? "เลือก pack ที่ต้องการ safe delete (จะปิดการขายแทน)" : "ยังไม่มี pack ให้ลบ",
      components: packs.length ? [buildSelectRow("admin:packs:select:delete", packs, "เลือก pack เพื่อ safe delete")] : [],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (id === "admin:packs:refresh") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await syncShopPanel(interaction.client);
    await logPackAction(interaction, "PACK_SYNC_PANEL", result.messageId, result);
    await interaction.editReply(`✅ Sync Shop Panel แล้ว (${result.mode})\nMessage ID: ${result.messageId}${result.mode === "CREATE" ? "\n\nเอา ID นี้ไปใส่ Railway ENV: PANEL_MESSAGE_ID" : ""}`);
    return true;
  }

  if (id.startsWith("admin:packs:edit_field:")) {
    const parts = id.split(":");
    const packId = parts[4];
    const field = parts[5];

    if (!packId || !field) {
      await safeReply(interaction, { content: "❌ รหัสการแก้ไข pack ไม่ถูกต้อง", ephemeral: true });
      return true;
    }

    const pack = await DonatePackRepo.getPackById(packId);
    if (!pack) {
      await safeReply(interaction, { content: "❌ ไม่พบ pack ที่เลือก", ephemeral: true });
      return true;
    }
    await interaction.showModal(editFieldModal(packId, field, pack[field] ?? ""));
    return true;
  }

  if (id.startsWith("admin:packs:add_details:")) {
    const packId = id.split(":")[3];
    await interaction.showModal(addPackDetailsModal(packId));
    return true;
  }

  return false;
}

export async function handleManagePacksSelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (!interaction.customId.startsWith("admin:packs:select:")) return false;

  const mode = interaction.customId.split(":")[3];
  const packId = interaction.values?.[0];
  const pack = await DonatePackRepo.getPackById(packId);

  if (!pack) {
    await safeReply(interaction, { content: "❌ ไม่พบ pack ที่เลือก", ephemeral: true });
    return true;
  }

  if (mode === "view") {
    await interaction.update({ embeds: [buildPackDetailEmbed(pack)], components: [] });
    return true;
  }

  if (mode === "preview") {
    await interaction.update({ embeds: [buildPackDetailEmbed(pack, "preview")], components: [] });
    return true;
  }

  if (mode === "edit") {
    await interaction.update({
      content: `กำลังแก้ pack: **${pack.pack_name}** (\`${pack.pack_code}\`)`,
      embeds: [buildPackDetailEmbed(pack)],
      components: buildEditFieldComponents(pack.pack_id),
    });
    return true;
  }

  if (mode === "toggle") {
    const updated = await DonatePackRepo.updatePackFields(pack.pack_id, { is_active: !pack.is_active }, interaction.user.tag ?? interaction.user.username);
    await logPackAction(interaction, updated.is_active ? "PACK_ACTIVATE" : "PACK_DEACTIVATE", updated.pack_code, {
      before_is_active: pack.is_active,
      after_is_active: updated.is_active,
    });
    await interaction.update({
      content: `✅ อัปเดตสถานะแล้ว: **${updated.pack_name}** → ${yn(updated.is_active)}`,
      embeds: [buildPackDetailEmbed(updated)],
      components: [],
    });
    return true;
  }

  if (mode === "delete") {
    const orderCount = await DonatePackRepo.countOrdersByPackId(pack.pack_id);
    const updated = await DonatePackRepo.updatePackFields(pack.pack_id, { is_active: false }, interaction.user.tag ?? interaction.user.username);
    await logPackAction(interaction, "PACK_SAFE_DELETE", updated.pack_code, { orderCount, action: "set is_active = false" });
    await interaction.update({
      content: `✅ Safe delete แล้ว: **${updated.pack_name}**\nระบบจะปิดการขายแทน ไม่ลบจริง${orderCount > 0 ? `\nออเดอร์ที่ผูกอยู่: ${orderCount}` : ""}`,
      embeds: [buildPackDetailEmbed(updated)],
      components: [],
    });
    return true;
  }

  return false;
}

export async function handleManagePacksModal(interaction) {
  if (!interaction.isModalSubmit()) return false;
  if (!interaction.customId.startsWith("admin:packs:modal_")) return false;

  if (interaction.customId === "admin:packs:modal_add") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const base = sanitizePackCreate({
        pack_code: interaction.fields.getTextInputValue("pack_code"),
        pack_name: interaction.fields.getTextInputValue("pack_name"),
        pack_type: interaction.fields.getTextInputValue("pack_type"),
        price: interaction.fields.getTextInputValue("price"),
        sort_order: interaction.fields.getTextInputValue("sort_order"),
      });

      const existing = await DonatePackRepo.getPackByCode(base.pack_code);
      if (existing) throw new Error(`pack_code ซ้ำ: ${base.pack_code}`);

      const created = await DonatePackRepo.createPack({
        ...base,
        description: null,
        panel_summary: null,
        image_url: null,
        embed_color: null,
        is_active: true,
        actorTag: interaction.user.tag ?? interaction.user.username,
      });

      await logPackAction(interaction, "PACK_CREATE", created.pack_code, { pack_id: created.pack_id });

      await interaction.editReply({
        content: `✅ สร้าง pack แล้ว: **${created.pack_name}** (\`${created.pack_code}\`)`,
        embeds: [buildPackDetailEmbed(created)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`admin:packs:add_details:${created.pack_id}`).setLabel("Add Details").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("admin:packs:refresh").setLabel("Sync Pack Panel").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("admin:packs:menu").setLabel("Back").setStyle(ButtonStyle.Secondary)
          ),
        ],
      });
    } catch (err) {
      await interaction.editReply(`❌ สร้าง pack ไม่สำเร็จ: ${err.message}`);
    }
    return true;
  }

  if (interaction.customId.startsWith("admin:packs:modal_add_details:")) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const packId = interaction.customId.split(":")[4];
    try {
      const fields = {
        description: interaction.fields.getTextInputValue("description").trim() || null,
        panel_summary: interaction.fields.getTextInputValue("panel_summary").trim() || null,
        image_url: interaction.fields.getTextInputValue("image_url").trim() || null,
        embed_color: normalizeColorInput(interaction.fields.getTextInputValue("embed_color")),
        is_active: parseTextBool(interaction.fields.getTextInputValue("is_active"), true),
      };

      const updated = await DonatePackRepo.updatePackFields(packId, fields, interaction.user.tag ?? interaction.user.username);
      if (!updated) throw new Error("ไม่พบ pack ที่จะอัปเดต");

      await logPackAction(interaction, "PACK_UPDATE_DETAILS", updated.pack_code, { fields: Object.keys(fields) });
      await interaction.editReply({
        content: `✅ เพิ่มรายละเอียด pack สำเร็จ: **${updated.pack_name}**`,
        embeds: [buildPackDetailEmbed(updated)],
        components: [],
      });
    } catch (err) {
      await interaction.editReply(`❌ บันทึกรายละเอียดไม่สำเร็จ: ${err.message}`);
    }
    return true;
  }

  if (interaction.customId.startsWith("admin:packs:modal_edit_field:")) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const [, , , field, packId] = interaction.customId.split(":").reverse();
    const allParts = interaction.customId.split(":");
    const truePackId = allParts[4];
    const trueField = allParts[5];

    try {
      const value = interaction.fields.getTextInputValue("value");
      const updatedValue = sanitizeUpdateField(trueField, value);
      const updated = await DonatePackRepo.updatePackFields(truePackId, { [trueField]: updatedValue }, interaction.user.tag ?? interaction.user.username);
      if (!updated) throw new Error("ไม่พบ pack ที่จะอัปเดต");

      await logPackAction(interaction, "PACK_UPDATE_FIELD", updated.pack_code, { field: trueField });
      await interaction.editReply({
        content: `✅ อัปเดต ${trueField} สำเร็จสำหรับ **${updated.pack_name}**`,
        embeds: [buildPackDetailEmbed(updated)],
        components: buildEditFieldComponents(updated.pack_id),
      });
    } catch (err) {
      await interaction.editReply(`❌ แก้ไขไม่สำเร็จ: ${err.message}`);
    }
    return true;
  }

  return false;
}

export function buildManagePacksMenuPayload() {
  return {
    embeds: [mainMenuEmbed()],
    components: mainMenuComponents(),
  };
}
