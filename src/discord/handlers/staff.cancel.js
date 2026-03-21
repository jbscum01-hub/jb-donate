import { MessageFlags } from "discord.js";
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { IDS } from "../../config/constants.js";
import { collectAllAttachments } from "../utils/attachments.js";
import { safeReply } from "../utils/messages.js";

function parseOrderNo(customId) {
  const parts = String(customId || "").split(":");
  if (parts[0] === "staff" && parts.length >= 3) return parts[2];
  const legacy = String(customId || "").match(/^staff_cancel:(.+)$/);
  return legacy?.[1] ?? null;
}

export async function cancelOrder(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    if (!isAdmin(interaction.member)) {
      return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
    }

    const orderNo = parseOrderNo(interaction.customId);
    if (!orderNo) return safeReply(interaction, { content: "❌ รูปแบบคำสั่งไม่ถูกต้อง", ephemeral: true });

    const order = await OrdersRepo.getByNo(orderNo);
    if (!order) return safeReply(interaction, { content: `❌ ไม่พบ Order: ${orderNo}`, ephemeral: true });

    if (!["PENDING", "APPROVED"].includes(order.status)) {
      return safeReply(interaction, { content: `❌ ยกเลิกไม่ได้ในสถานะ ${order.status}`, ephemeral: true });
    }

    const ticketCh = interaction.channel;
    const attachments = await collectAllAttachments(ticketCh);
    const archiveCh = await interaction.client.channels.fetch(IDS.SLIP_ARCHIVE_CHANNEL_ID).catch(() => null);

    const summary = [
      "🧾 **TICKET SUMMARY (CANCELLED)**",
      `Order: **${order.order_no}**`,
      `Buyer: <@${order.user_id}> (${order.user_tag})`,
      `IGN: ${order.ign}`,
      `SteamID: ${order.steam_id}`,
      `Pack: ${order.type}:${order.pack_code} (${order.amount}฿)`,
      `Staff: <@${interaction.user.id}>`,
      `Time: <t:${Math.floor(Date.now() / 1000)}:f>`,
    ].join("\n");

    if (archiveCh) {
      const attachList = attachments.length
        ? attachments.map(a => `- ${a.name} (${a.contentType ?? "file"}): ${a.url}`).join("\n")
        : "- (no attachments)";
      await archiveCh.send(summary + "\n\n**Attachments:**\n" + attachList).catch(() => {});
    }

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
  } catch (error) {
    console.error("cancelOrder error", error);
    return safeReply(interaction, { content: `❌ ยกเลิกไม่สำเร็จ: ${error?.message || String(error)}`, ephemeral: true }).catch(() => {});
  }
}
