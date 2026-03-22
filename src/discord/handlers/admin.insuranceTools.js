import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { isAdmin } from "../../domain/permissions.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";
import { IDS } from "../../config/constants.js";
import { safeReply } from "../utils/messages.js";

function normPlate(v) {
  return String(v || "").trim().toUpperCase();
}

function normKind(v, fallback = "") {
  const s = String(v || fallback || "").trim().toUpperCase();
  return s === "BOAT" ? "BOAT" : s === "CAR" ? "CAR" : "";
}

function fmtDateTH(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  } catch {
    return "-";
  }
}

function remainOf(insurance) {
  if (!insurance) return 0;
  return Math.max(0, Number(insurance.total || 0) - Number(insurance.used || 0));
}

async function rebuildVehicleCardMessage(client, plate, preferredKind = "") {
  const vehicle = await VehiclesRepo.getByPlate(plate);
  if (!vehicle) throw new Error(`ไม่พบทะเบียน ${plate} ในระบบยานพาหนะ`);

  const kind = normKind(preferredKind, vehicle.kind);
  const insurance = kind
    ? await InsuranceRepo.getInsurance(plate, kind)
    : await InsuranceRepo.getInsuranceByPlate(plate);

  const payload = buildVehicleCard({
    plate,
    kind: normKind(kind || insurance?.kind, vehicle.kind || "CAR") || "CAR",
    model: vehicle.model,
    ownerUserId: vehicle.owner_user_id,
    ownerTag: vehicle.owner_tag,
    insurance,
  });

  const plateLogChannelId = IDS.VEHICLE_PLATE_LOG_CHANNEL_ID;
  if (!plateLogChannelId) throw new Error("Missing VEHICLE_PLATE_LOG_CHANNEL_ID (DB/ENV)");

  const ch = await client.channels.fetch(plateLogChannelId).catch(() => null);
  if (!ch) throw new Error("ไม่สามารถเข้าถึงห้อง Vehicle Plate Log ได้");

  let msg = null;
  if (vehicle.plate_card_message_id) {
    msg = await ch.messages.fetch(vehicle.plate_card_message_id).catch(() => null);
  }

  if (msg) {
    await msg.edit(payload);
    return { mode: "edit", messageId: msg.id, vehicle, insurance };
  }

  const sent = await ch.send(payload);
  await VehiclesRepo.setCardMessageId(plate, sent.id);
  return { mode: "send", messageId: sent.id, vehicle, insurance };
}

function buildInsuranceSearchEmbed({ plate, vehicle, insurance, logs }) {
  const kind = insurance?.kind || vehicle?.kind || "-";
  const total = Number(insurance?.total || 0);
  const used = Number(insurance?.used || 0);
  const remain = remainOf(insurance);
  const status = !insurance
    ? "ไม่มีประกัน"
    : new Date(insurance.expire_at).getTime() <= Date.now()
      ? "หมดอายุ"
      : remain <= 0
        ? "ใช้ครบแล้ว"
        : "ใช้งานได้";

  const logsText = logs?.length
    ? logs
        .slice(0, 8)
        .map((r) => {
          const who = r.staff_id ? `<@${r.staff_id}>` : "-";
          const delta = Number(r.delta || 0);
          const deltaText = delta > 0 ? `+${delta}` : String(delta);
          return `• ${r.action || "-"} (${deltaText}) • ${fmtDateTH(r.created_at)} • ${who}`;
        })
        .join("\n")
    : "-";

  return new EmbedBuilder()
    .setColor(insurance ? 0x3498db : 0x95a5a6)
    .setTitle(`🛡️ Insurance Search • ${plate}`)
    .addFields(
      { name: "Kind", value: String(kind), inline: true },
      { name: "Model", value: vehicle?.model || "-", inline: true },
      { name: "Owner", value: vehicle?.owner_user_id ? `<@${vehicle.owner_user_id}> (${vehicle.owner_tag || "-"})` : (vehicle?.owner_tag || "-"), inline: false },
      { name: "Status", value: status, inline: true },
      { name: "เหลือ / ทั้งหมด", value: insurance ? `**${remain}** / **${total}**` : "-", inline: true },
      { name: "หมดอายุ", value: insurance?.expire_at ? fmtDateTH(insurance.expire_at) : "-", inline: true },
      { name: "Order No", value: insurance?.order_no || vehicle?.order_no || "-", inline: true },
      { name: "Card Message", value: vehicle?.plate_card_message_id || "-", inline: true },
      { name: "Recent Logs", value: logsText, inline: false },
    )
    .setFooter({ text: `Plate: ${plate}` });
}

function openInsuranceToolModal(interaction, action) {
  const titles = {
    search: "Search Insurance",
    cancel: "Cancel Insurance",
    rebuild: "Rebuild Insurance Card",
  };

  const modal = new ModalBuilder()
    .setCustomId(`admin:insurance:modal:${action}`)
    .setTitle(titles[action] || "Insurance Tool");

  const plateInput = new TextInputBuilder()
    .setCustomId("plate")
    .setLabel("Plate")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("เช่น ABC123");

  const kindInput = new TextInputBuilder()
    .setCustomId("kind")
    .setLabel("Kind (CAR/BOAT)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder("เว้นว่างได้");

  modal.addComponents(
    new ActionRowBuilder().addComponents(plateInput),
    new ActionRowBuilder().addComponents(kindInput),
  );

  if (action === "cancel") {
    const reasonInput = new TextInputBuilder()
      .setCustomId("reason")
      .setLabel("Reason")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setPlaceholder("เช่น ลงผิด / ผู้เล่นขอยกเลิก");
    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  }

  return interaction.showModal(modal);
}

export async function handleInsuranceAdminButton(interaction) {
  if (!interaction.isButton()) return;
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  const id = interaction.customId;
  if (id === "admin:insurance:search") return openInsuranceToolModal(interaction, "search");
  if (id === "admin:insurance:cancel") return openInsuranceToolModal(interaction, "cancel");
  if (id === "admin:insurance:rebuild") return openInsuranceToolModal(interaction, "rebuild");
}

export async function handleInsuranceAdminModal(interaction) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith("admin:insurance:modal:")) return;

  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ เฉพาะแอดมินเท่านั้น", ephemeral: true });
  }

  const action = interaction.customId.split(":").pop();
  const plate = normPlate(interaction.fields.getTextInputValue("plate"));
  const kind = normKind(interaction.fields.getTextInputValue("kind"));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  if (!plate) {
    return safeReply(interaction, { content: "❌ กรุณากรอกทะเบียน", ephemeral: true });
  }

  if (action === "search") {
    const vehicle = await VehiclesRepo.getByPlate(plate);
    const insurance = kind
      ? await InsuranceRepo.getInsurance(plate, kind)
      : await InsuranceRepo.getInsuranceByPlate(plate);

    if (!vehicle && !insurance) {
      return safeReply(interaction, { content: `❌ ไม่พบข้อมูล Insurance ของทะเบียน ${plate}`, ephemeral: true });
    }

    const logs = await InsuranceRepo.listLogsByPlate(plate, kind || insurance?.kind || vehicle?.kind || null, 8);
    const embed = buildInsuranceSearchEmbed({ plate, vehicle, insurance, logs });
    return safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  if (action === "cancel") {
    const vehicle = await VehiclesRepo.getByPlate(plate);
    const effectiveKind = kind || normKind(vehicle?.kind) || normKind((await InsuranceRepo.getInsuranceByPlate(plate))?.kind);
    if (!effectiveKind) {
      return safeReply(interaction, { content: `❌ ไม่พบชนิดของทะเบียน ${plate} กรุณาระบุ Kind เป็น CAR หรือ BOAT`, ephemeral: true });
    }

    const current = await InsuranceRepo.getInsurance(plate, effectiveKind);
    if (!current) {
      return safeReply(interaction, { content: `❌ ไม่พบประกันของทะเบียน ${plate} (${effectiveKind})`, ephemeral: true });
    }

    const alreadyInactive = new Date(current.expire_at).getTime() <= Date.now() || remainOf(current) <= 0;
    let reason = "";
    try { reason = String(interaction.fields.getTextInputValue("reason") || "").trim(); } catch {}

    await InsuranceRepo.cancelInsurance(plate, effectiveKind);
    await InsuranceRepo.log({
      guild_id: interaction.guildId,
      plate,
      kind: effectiveKind,
      action: "CANCEL",
      delta: 0,
      order_no: current.order_no ?? null,
      user_id: vehicle?.owner_user_id ?? null,
      staff_id: interaction.user.id,
      note: reason || "cancel from admin tool",
    });

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag ?? interaction.user.username,
      action: "INSURANCE_CANCEL",
      target: plate,
      meta: { kind: effectiveKind, reason: reason || null, alreadyInactive },
    });

    const rebuilt = await rebuildVehicleCardMessage(interaction.client, plate, effectiveKind).catch(() => null);
    const rebuiltText = rebuilt ? `\n♻️ Card: ${rebuilt.mode === "edit" ? "updated" : "re-posted"} (${rebuilt.messageId})` : "";

    return safeReply(interaction, {
      content: `✅ Cancel Insurance สำเร็จ\nทะเบียน: ${plate}\nKind: ${effectiveKind}${rebuiltText}`,
      ephemeral: true,
    });
  }

  if (action === "rebuild") {
    const rebuilt = await rebuildVehicleCardMessage(interaction.client, plate, kind);

    await InsuranceRepo.log({
      guild_id: interaction.guildId,
      plate,
      kind: normKind(kind, rebuilt.insurance?.kind || rebuilt.vehicle?.kind || "CAR") || "CAR",
      action: "REBUILD_CARD",
      delta: 0,
      order_no: rebuilt.vehicle?.order_no ?? rebuilt.insurance?.order_no ?? null,
      user_id: rebuilt.vehicle?.owner_user_id ?? null,
      staff_id: interaction.user.id,
      note: rebuilt.mode,
    });

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag ?? interaction.user.username,
      action: "INSURANCE_REBUILD_CARD",
      target: plate,
      meta: { kind: kind || rebuilt.insurance?.kind || rebuilt.vehicle?.kind || null, mode: rebuilt.mode, message_id: rebuilt.messageId },
    });

    return safeReply(interaction, {
      content: `✅ Rebuild Card สำเร็จ\nทะเบียน: ${plate}\nMode: ${rebuilt.mode === "edit" ? "edit เดิม" : "ส่งใหม่"}\nMessage ID: ${rebuilt.messageId}`,
      ephemeral: true,
    });
  }

  return safeReply(interaction, { content: "ℹ️ Insurance action not implemented", ephemeral: true });
}
