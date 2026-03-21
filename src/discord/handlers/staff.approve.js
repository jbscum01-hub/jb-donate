import { EmbedBuilder, MessageFlags } from "discord.js";
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { VipRepo } from "../../db/repo/vip.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { VIP_PACKS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";
import { ENV } from "../../config/env.js";
import { IDS } from "../../config/constants.js";

function parseOrderNo(customId) {
  const parts = String(customId || "").split(":");
  if (parts[0] === "staff" && parts.length >= 3) return parts[2];
  const legacy = String(customId || "").match(/^staff_approve:(.+)$/);
  return legacy?.[1] ?? null;
}

async function missingSelections(order) {
  if (order.type !== "DONATE") return [];
  const p = await DonatePackRepo.getPackDetails(order.pack_code);
  const needCar = (p?.vehicleChoices?.length ?? 0) > 0;
  const needBoat = (p?.boatChoices?.length ?? 0) > 0;

  const missing = [];
  if (needCar && !order.selected_vehicle) missing.push("CAR");
  if (needBoat && !order.selected_boat) missing.push("BOAT");
  return missing;
}

export async function approveOrder(interaction) {
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

    if (order.status !== "PENDING") {
      return safeReply(interaction, { content: `ℹ️ สถานะปัจจุบัน: ${order.status}`, ephemeral: true });
    }

    const missing = await missingSelections(order);
    if (missing.length) {
      const msg = [
        "❌ ยังเลือก Model ไม่ครบ จึงยัง APPROVE ไม่ได้",
        `ต้องเลือก: ${missing.join(" + ")}`,
        "ให้ผู้ซื้อเลือกจากเมนูใน Ticket ให้ครบก่อนนะ",
      ].join("\n");
      return safeReply(interaction, { content: msg, ephemeral: true });
    }

    await OrdersRepo.setStatus(orderNo, "APPROVED", interaction.user.id);

    if (order.type === "VIP") {
      const vip = VIP_PACKS[order.pack_code];
      if (!vip) {
        return safeReply(interaction, { content: "❌ เปิดใช้งาน VIP ไม่สำเร็จ: ไม่พบ VIP PACK", ephemeral: true });
      }

      const roleId = ENV[vip.roleKey];
      if (!roleId) {
        return safeReply(interaction, { content: `❌ เปิดใช้งาน VIP ไม่สำเร็จ: Missing env for ${vip.roleKey}`, ephemeral: true });
      }

      const daysToAdd = Number(vip.days ?? 30);
      const sub = await VipRepo.activateOrExtend({
        guildId: interaction.guildId,
        userId: order.user_id,
        vipCode: order.pack_code,
        roleId,
        daysToAdd,
      });

      const member = await interaction.guild.members.fetch(order.user_id).catch(() => null);
      if (member) await member.roles.add(roleId).catch(() => {});

      const ch = await interaction.client.channels.fetch(IDS.VIP_LOG_CHANNEL_ID).catch(() => null);
      if (ch) {
        const pack = VIP_PACKS[order.pack_code];
        const items = (pack?.displayItems ?? []).map((x) => `• ${x}`).join("\n") || "-";
        const cmds = (pack?.spawnItems ?? []).join("\n") || "-";

        const embed = new EmbedBuilder()
          .setTitle("👑 VIP Log")
          .setDescription("บันทึกการเปิดใช้งาน/ต่ออายุ VIP")
          .addFields(
            { name: "👤 ผู้เล่น", value: `<@${order.user_id}>`, inline: true },
            { name: "🎟️ แพ็ก", value: `${order.pack_code} (${order.amount}฿)`, inline: true },
            { name: "⏱️ ต่ออายุ", value: `+${daysToAdd} วัน`, inline: true },
            { name: "📅 หมดอายุ", value: String(sub?.expire_at ?? "?"), inline: false },
            { name: "📦 รายการ (อ่านง่าย)", value: items, inline: false },
            { name: "🧾 คำสั่งเสก", value: `\`\`\`\n${cmds}\n\`\`\``, inline: false },
          )
          .setFooter({ text: `Order: ${order.order_no} | Approved by ${interaction.user.tag}` });

        await ch.send({ embeds: [embed] }).catch(() => {});
      }
    }

    await AuditRepo.add({
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      action: "ORDER_APPROVE",
      target: orderNo,
      meta: { type: order.type, pack_code: order.pack_code },
    });

    return safeReply(interaction, { content: `✅ APPROVED: ${orderNo}`, ephemeral: true });
  } catch (error) {
    console.error("approveOrder error", error);
    return safeReply(interaction, { content: `❌ อนุมัติไม่สำเร็จ: ${error?.message || String(error)}`, ephemeral: true }).catch(() => {});
  }
}
