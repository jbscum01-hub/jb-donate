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

export async function setPlate(interaction) {
  // Button opens modal; modal submit saves plate.
  if (interaction.isButton()) {
    if (!isAdmin(interaction.member)) {
      return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
    }
    const orderNo = interaction.customId.split(":")[1];
    const modal = new ModalBuilder()
      .setCustomId(`set_plate_modal:${orderNo}`)
      .setTitle(`Set Plate - ${orderNo}`);

    const plate = new TextInputBuilder()
      .setCustomId("plate")
      .setLabel("ทะเบียน (ตัวเลข 6 หลัก)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(plate));
    return interaction.showModal(modal);
  }

  // Modal submit
  const orderNo = interaction.customId.split(":")[1];
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }

  const plate = interaction.fields.getTextInputValue("plate").trim();
  if (!isPlate6(plate)) {
    return safeReply(interaction, { content: "❌ ทะเบียนต้องเป็นตัวเลข 6 หลักเท่านั้น", ephemeral: true });
  }

  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  // Determine kind/model for vehicle registry:
  // If both selected_vehicle and selected_boat exist, prefer CAR for kind=CAR (you can extend later).
  const kind = order.selected_boat && !order.selected_vehicle ? "BOAT" : "CAR";
  const model = (kind === "BOAT") ? (order.selected_boat ?? "Unknown") : (order.selected_vehicle ?? "Unknown");

  // Ensure unique plate:
  const existing = await VehiclesRepo.getByPlate(plate);
  if (existing && existing.owner_user_id !== order.user_id) {
    return safeReply(interaction, { content: `❌ ทะเบียน ${plate} ถูกใช้งานแล้ว (ไม่ซ้ำ)`, ephemeral: true });
  }

  // Save to order + vehicles
  await OrdersRepo.setPlate(orderNo, plate, interaction.user.id);

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
    action: "SET_PLATE",
    target: plate,
    meta: { order_no: orderNo, kind, model, vehicle_card_message_id: messageId },
  });

  return safeReply(interaction, { content: `✅ บันทึกทะเบียน ${plate} และอัปเดต Vehicle Card แล้ว`, ephemeral: true });
}
