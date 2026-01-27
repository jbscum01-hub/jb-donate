// src/discord/handlers/staff.approve.js
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { DONATE_PACKS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";

function validateModelSelection(order) {
  if (order.type !== "DONATE") return { ok: true };

  const p = DONATE_PACKS?.[order.pack_code];
  if (!p) return { ok: false, msg: "❌ ไม่พบข้อมูลแพ็กในระบบ (catalog)" };

  const needCar = Boolean(p?.vehicleChoices?.length);
  const needBoat = Boolean(p?.boatChoices?.length);

  if (needCar && needBoat) {
    if (!order.selected_vehicle && !order.selected_boat) {
      return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **รถ 1 คัน** และ **เรือ 1 คัน** ก่อนจึงจะ APPROVE ได้" };
    }
    if (!order.selected_vehicle) {
      return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **รถ 1 คัน** ก่อนจึงจะ APPROVE ได้" };
    }
    if (!order.selected_boat) {
      return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **เรือ 1 คัน** ก่อนจึงจะ APPROVE ได้" };
    }
  } else if (needCar) {
    if (!order.selected_vehicle) {
      return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **รถ 1 คัน** ก่อนจึงจะ APPROVE ได้" };
    }
  } else if (needBoat) {
    if (!order.selected_boat) {
      return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **เรือ 1 คัน** ก่อนจึงจะ APPROVE ได้" };
    }
  }

  return { ok: true };
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

  // ✅ NEW: enforce selection rule
  const v = validateModelSelection(order);
  if (!v.ok) {
    return safeReply(interaction, { content: v.msg, ephemeral: true });
  }

  const updated = await OrdersRepo.setStatus(orderNo, "APPROVED", interaction.user.id);

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "ORDER_APPROVE",
    target: orderNo,
    meta: {
      from: order.status,
      to: updated.status,
      selected_vehicle: order.selected_vehicle ?? null,
      selected_boat: order.selected_boat ?? null,
    },
  });

  return safeReply(interaction, { content: `✅ APPROVED: ${orderNo}`, ephemeral: true });
}
