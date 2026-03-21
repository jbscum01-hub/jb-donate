import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { VehiclesRepo } from "../../db/repo/vehicles.repo.js";
import { InsuranceRepo } from "../../db/repo/insurance.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { IDS } from "../../config/constants.js";
import { buildVehicleCard } from "../panels/vehicleCard.js";
import { safeReply } from "../utils/messages.js";

function pickKindFromButton(customId) {
  if (customId.startsWith("staff_set_car_plate:")) return "CAR";
  if (customId.startsWith("staff_set_boat_plate:")) return "BOAT";
  if (customId.startsWith("staff:set_plate:CAR:")) return "CAR";
  if (customId.startsWith("staff:set_plate:BOAT:")) return "BOAT";
  return null;
}

function parseOrderNoFromButton(customId) {
  const parts = String(customId || "").split(":");
  if (customId.startsWith("staff_set_car_plate:") || customId.startsWith("staff_set_boat_plate:")) {
    return parts[1] ?? null;
  }
  if (parts[0] === "staff" && parts[1] === "set_plate" && parts.length >= 4) {
    return parts[3];
  }
  return null;
}

export async function setPlate(interaction) {
  try {
    if (interaction.isButton()) {
      if (!isAdmin(interaction.member)) {
        return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
      }

      const orderNo = parseOrderNoFromButton(interaction.customId);
      const kind = pickKindFromButton(interaction.customId) ?? "CAR";
      if (!orderNo) {
        return safeReply(interaction, { content: "❌ ไม่พบเลข Order", ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId(`set_plate_modal:${kind}:${orderNo}`)
        .setTitle(`Set ${kind} Plate - ${orderNo}`);

      const plate = new TextInputBuilder()
        .setCustomId("plate")
        .setLabel(kind === "BOAT" ? "ทะเบียนเรือ (ไม่กรอกก็ได้)" : "ทะเบียนรถ (ไม่กรอกก็ได้)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(plate));
      return interaction.showModal(modal);
    }

    if (!isAdmin(interaction.member)) {
      return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const parts = interaction.customId.split(":");
    const kind = parts[1] === "BOAT" ? "BOAT" : "CAR";
    const orderNo = parts[2];
    if (!orderNo) {
      return safeReply(interaction, { content: "❌ ไม่พบเลข Order", ephemeral: true });
    }

    const plate = interaction.fields.getTextInputValue("plate").trim();
    if (!plate) {
      return safeReply(interaction, {
        content: "⚠️ ยังไม่ได้ตั้งทะเบียน (สามารถตั้งทีหลังได้)",
        ephemeral: true,
      });
    }

    const order = await OrdersRepo.getByNo(orderNo);
    if (!order) return safeReply(interaction, { content: `❌ ไม่พบ Order: ${orderNo}`, ephemeral: true });

    const model = kind === "BOAT"
      ? order.selected_boat ?? order.boat_model ?? "Unknown"
      : order.selected_vehicle ?? order.vehicle_model ?? "Unknown";

    const existing = await VehiclesRepo.getByPlate(plate);
    if (existing && existing.owner_user_id && existing.owner_user_id !== order.user_id) {
      return safeReply(interaction, { content: `❌ ทะเบียน ${plate} ถูกใช้งานแล้ว`, ephemeral: true });
    }

    if (kind === "BOAT") await OrdersRepo.setBoatPlate(orderNo, plate, interaction.user.id);
    else await OrdersRepo.setCarPlate(orderNo, plate, interaction.user.id);

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

    const ins = await InsuranceRepo.getInsurance(plate, kind);
    const payload = buildVehicleCard({
      plate,
      kind,
      model,
      ownerUserId: order.user_id,
      ownerTag: order.user_tag,
      insurance: ins,
    });

    const plateLogCh = await interaction.client.channels.fetch(IDS.VEHICLE_PLATE_LOG_CHANNEL_ID).catch(() => null);
    if (!plateLogCh) {
      return safeReply(interaction, { content: `✅ บันทึกทะเบียน ${plate} (${kind}) แล้ว แต่ไม่พบห้อง VEHICLE_PLATE_LOG_CHANNEL_ID`, ephemeral: true });
    }

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
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      action: "SET_PLATE",
      target: plate,
      meta: { order_no: orderNo, kind, model, vehicle_card_message_id: messageId },
    });

    return safeReply(interaction, {
      content: `✅ บันทึกทะเบียน ${plate} (${kind}) และอัปเดต Vehicle Card แล้ว`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("setPlate error:", err);
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
    } catch {}
    return safeReply(interaction, { content: `❌ ตั้งทะเบียนไม่สำเร็จ: ${err?.message || String(err)}`, ephemeral: true });
  }
}
