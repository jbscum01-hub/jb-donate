import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { safeReply } from "../utils/messages.js";

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
