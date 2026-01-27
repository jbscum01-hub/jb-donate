// src/discord/handlers/staff.approve.js
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { DONATE_PACKS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";

function missingSelections(order) {
  if (order.type !== "DONATE") return [];
  const p = DONATE_PACKS[order.pack_code];
  const needCar = (p?.vehicleChoices?.length ?? 0) > 0;
  const needBoat = (p?.boatChoices?.length ?? 0) > 0;

  const missing = [];
  if (needCar && !order.selected_vehicle) missing.push("CAR");
  if (needBoat && !order.selected_boat) missing.push("BOAT");
  return missing;
}

export async function approveOrder(interaction) {
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }
  const orderNo = interaction.customId.split(":")[1];
  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  if (order.status !== "PENDING") {
    return safeReply(interaction, { content: `ℹ️ สถานะปัจจุบัน: ${order.status}`, ephemeral: true });
  }

  // ✅ enforce model selection completeness for packs that have choices
  const missing = missingSelections(order);
  if (missing.length) {
    const msg = [
      "❌ ยังเลือก Model ไม่ครบ จึงยัง APPROVE ไม่ได้",
      `ต้องเลือก: ${missing.join(" + ")}`,
      "ให้ผู้ซื้อเลือกจากเมนูใน Ticket ให้ครบก่อนนะ",
    ].join("\n");
    return safeReply(interaction, { content: msg, ephemeral: true });
  }

  const updated = await OrdersRepo.setStatus(orderNo, "APPROVED", interaction.user.id);

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "ORDER_APPROVE",
    target: orderNo,
    meta: { from: order.status, to: updated.status },
  });

  return safeReply(interaction, { content: `✅ APPROVED: ${orderNo}`, ephemeral: true });
}
