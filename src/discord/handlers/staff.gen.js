// src/discord/handlers/staff.gen.js
import { isAdmin } from "../../domain/permissions.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { AuditRepo } from "../../db/repo/audit.repo.js";
import { DONATE_PACKS, VEHICLE_COMMANDS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";

function validateModelSelection(order) {
  if (order.type !== "DONATE") return { ok: true };

  const p = DONATE_PACKS?.[order.pack_code];
  if (!p) return { ok: false, msg: "❌ ไม่พบข้อมูลแพ็กในระบบ (catalog)" };

  const needCar = Boolean(p?.vehicleChoices?.length);
  const needBoat = Boolean(p?.boatChoices?.length);

  if (needCar && needBoat) {
    if (!order.selected_vehicle && !order.selected_boat) {
      return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **รถ 1 คัน** และ **เรือ 1 คัน** ก่อนจึงจะ GEN ได้" };
    }
    if (!order.selected_vehicle) return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **รถ 1 คัน** ก่อนจึงจะ GEN ได้" };
    if (!order.selected_boat) return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **เรือ 1 คัน** ก่อนจึงจะ GEN ได้" };
  } else if (needCar) {
    if (!order.selected_vehicle) return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **รถ 1 คัน** ก่อนจึงจะ GEN ได้" };
  } else if (needBoat) {
    if (!order.selected_boat) return { ok: false, msg: "❌ แพ็กนี้ต้องเลือก **เรือ 1 คัน** ก่อนจึงจะ GEN ได้" };
  }

  return { ok: true };
}

function buildSpawnLines(order) {
  const lines = [];

  if (order.selected_vehicle) {
    const cmd = VEHICLE_COMMANDS?.[order.selected_vehicle];
    if (cmd) lines.push(cmd);
  }
  if (order.selected_boat) {
    const cmd = VEHICLE_COMMANDS?.[order.selected_boat];
    if (cmd) lines.push(cmd);
  }

  return lines;
}

export async function genOrder(interaction) {
  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, { content: "❌ สำหรับทีมงานเท่านั้น", ephemeral: true });
  }

  const orderNo = interaction.customId.split(":")[1];
  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  if (order.status !== "APPROVED") {
    return safeReply(interaction, { content: "❌ ต้อง APPROVE ก่อนจึงจะ GEN ได้", ephemeral: true });
  }

  // ✅ NEW: enforce model completeness
  const v = validateModelSelection(order);
  if (!v.ok) return safeReply(interaction, { content: v.msg, ephemeral: true });

  // สร้างคำสั่ง spawn
  const spawnLines = buildSpawnLines(order);

  // ถ้าแพ็กบังคับเลือก แต่ยังไม่มี command (กันกรณี model ไม่อยู่ใน map)
  // (ปกติไม่ควรเกิด แต่กันพัง)
  if (order.type === "DONATE") {
    const p = DONATE_PACKS?.[order.pack_code];
    const needCar = Boolean(p?.vehicleChoices?.length);
    const needBoat = Boolean(p?.boatChoices?.length);

    if ((needCar || needBoat) && spawnLines.length === 0) {
      return safeReply(interaction, {
        content: "❌ ไม่พบคำสั่ง Spawn ของ model ที่เลือก (VEHICLE_COMMANDS ไม่ตรง) กรุณาเช็ค config",
        ephemeral: true
      });
    }
  }

  // ✅ ส่งลงห้องให้ทุกคนเห็น (public)
  if (spawnLines.length) {
    await interaction.channel.send({
      content: [
        "📦 **GEN SPAWN COMMANDS**",
        `Order: **${orderNo}**`,
        `By staff: <@${interaction.user.id}>`,
        order.selected_vehicle ? `🚗 CAR: **${order.selected_vehicle}**` : null,
        order.selected_boat ? `🚤 BOAT: **${order.selected_boat}**` : null,
        "",
        "```",
        ...spawnLines,
        "```",
      ].filter(Boolean).join("\n")
    }).catch(() => {});
  } else {
    await interaction.channel.send({
      content: `ℹ️ Order **${orderNo}** ไม่มีรถ/เรือที่ต้อง GEN`
    }).catch(() => {});
  }

  await AuditRepo.add({
    guild_id: interaction.guildId,
    actor_id: interaction.user.id,
    actor_tag: interaction.user.tag,
    action: "ORDER_GEN",
    target: orderNo,
    meta: {
      selected_vehicle: order.selected_vehicle ?? null,
      selected_boat: order.selected_boat ?? null,
      spawn_count: spawnLines.length,
    },
  });

  return safeReply(interaction, { content: "✅ ส่งคำสั่ง GEN ลงห้องแล้ว", ephemeral: true });
}
