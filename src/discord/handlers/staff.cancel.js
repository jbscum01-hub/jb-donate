// src/discord/handlers/staff.cancel.js
import { MessageFlags } from "discord.js";
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { IDS } from "../../config/constants.js";
import { collectAllAttachments } from "../utils/attachments.js";
import { safeReply } from "../utils/messages.js";

export async function cancelOrder(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }

  const orderNo = interaction.customId.split(":")[1];
  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  if (order.status === "SUCCESS" || order.status === "CANCELLED") {
    return safeReply(interaction, { content: `ℹ️ สถานะปัจจุบัน: ${order.status}`, ephemeral: true });
  }

  // Archive attachments before delete
  const ticketCh = interaction.channel;
  const attachments = await collectAllAttachments(ticketCh);
  const archiveCh = await interaction.client.channels.fetch(IDS.SLIP_ARCHIVE_CHANNEL_ID);

  const summary = [
    "🧾 **TICKET SUMMARY (CANCELLED)**",
    `Order: **${order.order_no}**`,
    `Buyer: <@${order.user_id}> (${order.user_tag})`,
    `IGN: ${order.ign}`,
    `SteamID: ${order.steam_id}`,
    `Pack: ${order.type}:${order.pack_code} (${order.amount}฿)`,
    `CAR PLATE: ${order.car_plate ?? "-"}`,
    `BOAT PLATE: ${order.boat_plate ?? "-"}`,
    `Staff: <@${interaction.user.id}>`,
    `Time: <t:${Math.floor(Date.now() / 1000)}:f>`,
  ].join("\n");

  const attachList = attachments.length
    ? attachments.map(a => `- ${a.name} (${a.contentType ?? "file"}): ${a.url}`).join("\n")
    : "- (no attachments)";

  await archiveCh.send(summary + "\n\n**Attachments:**\n" + attachList);

  await OrdersRepo.setStatus(orderNo, "CANCELLED", interaction.user.id);

  await AuditRepo.add({
    guildId: interaction.guildId,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag,
    action: "ORDER_CANCEL",
    target: orderNo,
    meta: { attachments: attachments.length },
  });

  await safeReply(interaction, { content: "❌ ยกเลิกออเดอร์แล้ว กำลังลบห้อง…", ephemeral: true });
  await ticketCh.delete("Ticket cancelled").catch(() => {});
}
