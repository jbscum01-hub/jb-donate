// src/discord/handlers/staff.approve.js
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { VipRepo } from "../../db/repo/vip.repo.js";
import { DONATE_PACKS, VIP_PACKS } from "../../domain/catalog.js";
import { ENV } from "../../config/env.js";
import { IDS } from "../../config/constants.js";
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

async function logVip(client, text) {
  try {
    const ch = await client.channels.fetch(IDS.VIP_LOG_CHANNEL_ID);
    await ch.send(text);
  } catch {}
}

async function ensureVipActivated(interaction, order) {
  const vip = VIP_PACKS[order.pack_code];
  if (!vip) {
    throw new Error(`Unknown VIP pack_code: ${order.pack_code}`);
  }

  const roleId = ENV[vip.roleKey];
  if (!roleId) {
    throw new Error(`Missing env role for VIP: ${vip.roleKey}`);
  }

  // default VIP duration: 30 days (ปรับได้โดยใส่ vip.days ใน catalog)
  const days = Number(vip.days ?? 30);

  // 1) upsert/extend subscription
  const sub = await VipRepo.activateOrExtend({
    guildId: order.guild_id,
    userId: order.user_id,
    vipCode: order.pack_code,
    roleId,
    daysToAdd: days,
  });

  // 2) grant Discord role (best effort)
  try {
    const guild = await interaction.client.guilds.fetch(order.guild_id);
    const member = await guild.members.fetch(order.user_id);
    await member.roles.add(roleId);
  } catch {}

  await logVip(
    interaction.client,
    `✅ VIP ACTIVATED | ${order.pack_code} | <@${order.user_id}> | +${days} days | expire: ${sub?.expire_at ?? "-"}`
  );

  return sub;
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

  // ✅ VIP: activate subscription + give role at APPROVE
  if (order.type === "VIP") {
    try {
      await ensureVipActivated(interaction, order);
    } catch (e) {
      return safeReply(interaction, {
        content: `❌ เปิดใช้งาน VIP ไม่สำเร็จ: ${e?.message ?? String(e)}`,
        ephemeral: true,
      });
    }
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
