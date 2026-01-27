// src/discord/handlers/ticket.vehicle.select.js
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { DONATE_PACKS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";

function requiredKindsForOrder(order) {
  if (order.type !== "DONATE") return { needCar: false, needBoat: false };

  const p = DONATE_PACKS?.[order.pack_code];
  const needCar = Boolean(p?.vehicleChoices?.length);
  const needBoat = Boolean(p?.boatChoices?.length);
  return { needCar, needBoat };
}

function summaryLine(order) {
  const car = order.selected_vehicle ? `🚗 CAR: **${order.selected_vehicle}**` : "🚗 CAR: _ยังไม่เลือก_";
  const boat = order.selected_boat ? `🚤 BOAT: **${order.selected_boat}**` : "🚤 BOAT: _ยังไม่เลือก_";
  return `${car} | ${boat}`;
}

export async function handleTicketVehicleSelect(interaction) {
  // must be select menu
  if (!interaction.isStringSelectMenu()) return;

  const orderNo = interaction.customId.split(":")[1];
  const [kind, model] = (interaction.values?.[0] || "").split(":");

  if (!orderNo || !kind || !model) {
    // ไม่ควรเกิด แต่กันพัง
    return safeReply(interaction, { content: "❌ รูปแบบข้อมูลไม่ถูกต้อง ลองเลือกใหม่อีกครั้ง", ephemeral: true });
  }

  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  // allow change only before APPROVED
  if (order.status !== "PENDING") {
    return safeReply(interaction, { content: "❌ เปลี่ยน model ได้เฉพาะก่อน APPROVE เท่านั้น", ephemeral: true });
  }

  // only ticket owner can select (กันคนอื่นกดแทน)
  if (interaction.user.id !== order.user_id) {
    return safeReply(interaction, { content: "❌ เฉพาะเจ้าของ Ticket เท่านั้นที่เลือกได้", ephemeral: true });
  }

  let nextCar = order.selected_vehicle;
  let nextBoat = order.selected_boat;

  if (kind === "CAR") nextCar = model;
  if (kind === "BOAT") nextBoat = model;

  // ถ้าเลือกซ้ำค่าเดิม → ไม่ต้องสแปมประกาศ
  const changed = (nextCar !== order.selected_vehicle) || (nextBoat !== order.selected_boat);

  const updated = await OrdersRepo.setSelection(orderNo, nextCar, nextBoat);

  // ✅ ตอบ interaction ให้ไวกัน timeout
  // safeReply ของคุณน่าจะเลือก reply/update ให้เองอยู่แล้ว
  await safeReply(interaction, { content: `✅ บันทึกแล้ว: ${kind} = ${model}`, ephemeral: true });

  // ✅ ประกาศให้ทั้งห้องเห็น (ถ้ามีการเปลี่ยนจริง)
  if (changed) {
    const { needCar, needBoat } = requiredKindsForOrder(order);

    const needNote =
      (needCar && !updated.selected_vehicle) || (needBoat && !updated.selected_boat)
        ? "\n⚠️ *ยังเลือกไม่ครบ* (ต้องเลือกให้ครบก่อนทีมงานจะ APPROVE ได้)"
        : "\n✅ *เลือกครบแล้ว* (ทีมงานสามารถ APPROVE ต่อได้)";

    await interaction.channel.send({
      content: [
        "📌 **MODEL UPDATED**",
        `ผู้เล่น: <@${order.user_id}>`,
        `Order: **${orderNo}**`,
        summaryLine(updated),
        (needCar || needBoat) ? needNote : ""
      ].filter(Boolean).join("\n"),
    }).catch(() => {});
  }
}
