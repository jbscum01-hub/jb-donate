// src/discord/handlers/admin.addInsurance.js
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

import { isAdmin } from "../../domain/permissions.js";
import { isPlate6 } from "../../domain/validators.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { IDS } from "../../config/constants.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";
import { safeReply } from "../utils/messages.js";

function toInt(v) {
  const x = Number(String(v || "").trim());
  return Number.isFinite(x) ? Math.floor(x) : NaN;
}

async function refreshVehicleCard(client, plate, kind) {
  const vehicle = await VehiclesRepo.getByPlate(plate);
  if (!vehicle) return null;

  const insurance = await InsuranceRepo.getInsurance(plate, kind);
  const payload = buildVehicleCard({
    plate,
    kind,
    model: vehicle.model,
    ownerUserId: vehicle.owner_user_id,
    ownerTag: vehicle.owner_tag,
    insurance,
  });

  const plateLogCh = await client.channels.fetch(IDS.VEHICLE_PLATE_LOG_CHANNEL_ID);
  let messageId = vehicle.plate_card_message_id;

  if (messageId) {
    const msg = await plateLogCh.messages.fetch(messageId).catch(() => null);
    if (msg) {
      await msg.edit(payload).catch(() => {});
      return { messageId, payload, insurance, vehicle };
    }
  }

  const newMsg = await plateLogCh.send(payload);
  await VehiclesRepo.setCardMessageId(plate, newMsg.id);
  messageId = newMsg.id;
  return { messageId, payload, insurance, vehicle };
}

// ===== Button: open modal =====
export async function openManualInsuranceModal(interaction) {
  if (!interaction.isButton()) return;
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  // customId: admin:add_insurance:CAR|BOAT
  const parts = interaction.customId.split(":");
  const kind = parts[2] === "BOAT" ? "BOAT" : "CAR";

  const modal = new ModalBuilder()
    .setCustomId(`admin_add_insurance_modal:${kind}`)
    .setTitle(`Add ${kind} Insurance`);

  const plate = new TextInputBuilder()
    .setCustomId("plate")
    .setLabel(kind === "BOAT" ? "ทะเบียนเรือ (ตัวเลข 6 หลัก)" : "ทะเบียนรถ (ตัวเลข 6 หลัก)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const total = new TextInputBuilder()
    .setCustomId("total")
    .setLabel("จำนวนครั้ง (ทั้งหมดที่จะเพิ่ม)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("เช่น 5");

  const days = new TextInputBuilder()
    .setCustomId("days")
    .setLabel("เพิ่มวันหมดอายุ (จำนวนวัน)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("เช่น 30");

  const note = new TextInputBuilder()
    .setCustomId("note")
    .setLabel("หมายเหตุ (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(plate),
    new ActionRowBuilder().addComponents(total),
    new ActionRowBuilder().addComponents(days),
    new ActionRowBuilder().addComponents(note)
  );

  // IMPORTANT: do NOT defer/reply before showModal
  return interaction.showModal(modal);
}

// ===== Modal submit: grant insurance =====
export async function addManualInsuranceFromModal(interaction) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith("admin_add_insurance_modal:")) return;

  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  const kind = interaction.customId.split(":")[1] === "BOAT" ? "BOAT" : "CAR";
  const plate = interaction.fields.getTextInputValue("plate").trim();
  const total = toInt(interaction.fields.getTextInputValue("total"));
  const days = toInt(interaction.fields.getTextInputValue("days"));
  const note = (interaction.fields.getTextInputValue("note") || "").trim();

  if (!isPlate6(plate)) {
    return safeReply(interaction, { content: "❌ ทะเบียนต้องเป็นตัวเลข 6 หลักเท่านั้น", ephemeral: true });
  }
  if (!Number.isFinite(total) || total <= 0) {
    return safeReply(interaction, { content: "❌ จำนวนครั้งต้องเป็นตัวเลขมากกว่า 0", ephemeral: true });
  }
  if (!Number.isFinite(days) || days <= 0) {
    return safeReply(interaction, { content: "❌ จำนวนวันต้องเป็นตัวเลขมากกว่า 0", ephemeral: true });
  }

  const vehicle = await VehiclesRepo.getByPlate(plate);
  if (!vehicle) {
    return safeReply(interaction, {
      content: `❌ ไม่พบทะเบียน ${plate} ในระบบ\nℹ️ ต้องลงทะเบียนทะเบียน (Vehicle Card) ก่อน จึงจะเพิ่มประกันได้`,
      ephemeral: true,
    });
  }
  if (vehicle.kind !== kind) {
    return safeReply(interaction, {
      content: `❌ ทะเบียน ${plate} เป็นชนิด ${vehicle.kind} แต่คุณกำลังเพิ่ม ${kind}`,
      ephemeral: true,
    });
  }

  // Upsert (accumulate total + extend expiry)
  const ins = await InsuranceRepo.upsertInsurance({
    plate,
    kind,
    add_total: total,
    days,
    order_no: vehicle.order_no ?? null,
    source: "MANUAL",
  });

  await InsuranceRepo.log({
    guild_id: interaction.guildId,
    plate,
    kind,
    action: "GRANT",
    delta: total,
    order_no: vehicle.order_no ?? null,
    user_id: vehicle.owner_user_id,
    staff_id: interaction.user.id,
    note: note ? `manual grant: ${note}` : "manual grant",
  });

  const refreshed = await refreshVehicleCard(interaction.client, plate, kind);

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "INSURANCE_MANUAL_GRANT",
    target: plate,
    meta: { kind, add_total: total, days, note: note || null, vehicle_card_message_id: refreshed?.messageId ?? null },
  });

  // Send log (best effort) with donate-like format
  try {
    const logCh = await interaction.client.channels.fetch(IDS.LOG_CHANNEL_ID).catch(() => null);
    if (logCh) {
      const remain = Math.max(0, (ins.total ?? 0) - (ins.used ?? 0));
      const exp = ins.expire_at
        ? `<t:${Math.floor(new Date(ins.expire_at).getTime() / 1000)}:f>`
        : "-";
      const logEmbed = new EmbedBuilder()
        .setTitle("✅ MANUAL INSURANCE GRANTED")
        .addFields(
          { name: "ทะเบียน", value: plate, inline: true },
          { name: "Kind", value: kind, inline: true },
          { name: "Owner", value: `<@${vehicle.owner_user_id}> (${vehicle.owner_tag})`, inline: false },
          { name: "Insurance", value: `เหลือ **${remain}** / ทั้งหมด **${ins.total}**`, inline: false },
          { name: "Expire", value: exp, inline: true },
          { name: "Added", value: `+${total} ครั้ง, +${days} วัน`, inline: true },
          { name: "By", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
        );
      if (note) logEmbed.addFields({ name: "Note", value: note, inline: false });
      await logCh.send({ embeds: [logEmbed] }).catch(() => {});
    }
  } catch {}

  return safeReply(interaction, {
    content: `✅ เพิ่มประกัน ${kind} ให้ทะเบียน ${plate} แล้ว (+${total} ครั้ง / +${days} วัน)\n📌 Vehicle Card: <#${IDS.VEHICLE_PLATE_LOG_CHANNEL_ID}>`,
    ephemeral: true,
  });
}
