// src/discord/handlers/staff.setPlate.js
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { isAdmin } from "../../domain/permissions.js";
import { isPlate6 } from "../../domain/validators.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { IDS } from "../../config/constants.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";
import { safeReply } from "../utils/messages.js";

function parseSetPlateBtn(customId) {
  // staff_set_plate:CAR:JB-000001
  const parts = String(customId || "").split(":");
  return { kind: parts[1], orderNo: parts[2] };
}

function parseSetPlateModal(customId) {
  // set_plate_modal:CAR:JB-000001
  const parts = String(customId || "").split(":");
  return { kind: parts[1], orderNo: parts[2] };
}

export async function setPlate(interaction) {
  // Button -> open modal
  if (interaction.isButton()) {
    if (!isAdmin(interaction.member)) {
      return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
    }

    const { kind, orderNo } = parseSetPlateBtn(interaction.customId);
    if (kind !== "CAR" && kind !== "BOAT" || !orderNo) {
      return safeReply(interaction, { content: "❌ ปุ่มตั้งทะเบียนผิดรูปแบบ", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`set_plate_modal:${kind}:${orderNo}`)
      .setTitle(`Set ${kind} Plate - ${orderNo}`);

    const plate = new TextInputBuilder()
      .setCustomId("plate")
      .setLabel(kind === "CAR" ? "ทะเบียนรถ (ตัวเลข 6 หลัก)" : "ทะเบียนเรือ (ตัวเลข 6 หลัก)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(plate));
    return interaction.showModal(modal);
  }

  // Modal submit -> save plate
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }

  const { kind, orderNo } = parseSetPlateModal(interaction.customId);
  if (kind !== "CAR" && kind !== "BOAT" || !orderNo) {
    return safeReply(interaction, { content: "❌ modal ตั้งทะเบียนผิดรูปแบบ", ephemeral: true });
  }

  const plate = interaction.fields.getTextInputValue("plate").trim();
  if (!isPlate6(plate)) {
    return safeReply(interaction, { content: "❌ ทะเบียนต้องเป็นตัวเลข 6 หลักเท่านั้น", ephemeral: true });
  }

  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  // ต้องเลือก model ก่อน (แยกตาม kind)
  const model =
    kind === "CAR"
      ? (order.selected_vehicle ?? null)
      : (order.selected_boat ?? null);

  if (!model) {
    return safeReply(interaction, {
      content: `❌ ต้องเลือก ${kind === "CAR" ? "รถ" : "เรือ"} ก่อน (model)`,
      ephemeral: true
    });
  }

  // Ensure unique plate
  const existing = await VehiclesRepo.getByPlate(plate);
  if (existing && existing.owner_user_id !== order.user_id) {
    return safeReply(interaction, { content: `❌ ทะเบียน ${plate} ถูกใช้งานแล้ว (ไม่ซ้ำ)`, ephemeral: true });
  }

  // Save to orders (NEW columns)
  if (kind === "CAR") {
    await OrdersRepo.setCarPlate(orderNo, plate, interaction.user.id);
  } else {
    await OrdersRepo.setBoatPlate(orderNo, plate, interaction.user.id);
  }

  // Upsert vehicle registry
  const v = await VehiclesRepo.upsert({
    guild_id: interaction.guildId,
    plate,
    kind,
    model,
    owner_user_id: order.user_id,
    owner_tag: order.user_tag,
    order_no: orderNo,
    registered_by: interaction.user.id,
  });

  // Build/refresh vehicle card
  const ins = await InsuranceRepo.getInsurance(plate, kind);
  const payload = buildVehicleCard({
    plate,
    kind,
    model,
    ownerUserId: order.user_id,
    ownerTag: order.user_tag,
    insurance: ins,
  });

  const plateLogCh = await interaction.client.channels.fetch(IDS.VEHICLE_PLATE_LOG_CHANNEL_ID);

  let messageId = v.plate_card_message_id;
  if (messageId) {
    const msg = await plateLogCh.messages.fetch(messageId).catch(() => null);
    if (msg) {
      await msg.edit(payload);
    } else {
      const newMsg = await plateLogCh.send(payload);
      await VehiclesRepo.setCardMessageId(plate, newMsg.id);
      messageId = newMsg.id;
    }
  } else {
    const newMsg = await plateLogCh.send(payload);
    await VehiclesRepo.setCardMessageId(plate, newMsg.id);
    messageId = newMsg.id;
  }

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: kind === "CAR" ? "SET_CAR_PLATE" : "SET_BOAT_PLATE",
    target: plate,
    meta: { order_no: orderNo, kind, model, vehicle_card_message_id: messageId },
  });

  return safeReply(interaction, {
    content: `✅ บันทึกทะเบียน${kind === "CAR" ? "รถ" : "เรือ"} ${plate} และอัปเดต Vehicle Card แล้ว`,
    ephemeral: true
  });
}
