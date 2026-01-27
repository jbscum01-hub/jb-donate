// src/discord/handlers/ticket.vehicle.select.js
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { DONATE_PACKS } from "../../domain/catalog.js";
import { safeReply } from "../utils/messages.js";

function requirements(order) {
  if (order.type !== "DONATE") return { requireCar: false, requireBoat: false };
  const p = DONATE_PACKS[order.pack_code];
  const requireCar = (p?.vehicleChoices?.length ?? 0) > 0;
  const requireBoat = (p?.boatChoices?.length ?? 0) > 0;
  return { requireCar, requireBoat };
}

export async function handleTicketVehicleSelect(interaction) {
  const orderNo = interaction.customId.split(":")[1];
  const [kind, model] = interaction.values[0].split(":");

  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  // allow change only before APPROVED
  if (order.status !== "PENDING") {
    return safeReply(interaction, { content: "❌ เปลี่ยน model ได้เฉพาะก่อน APPROVE เท่านั้น", ephemeral: true });
  }

  let v = order.selected_vehicle;
  let b = order.selected_boat;

  if (kind === "CAR") v = model;
  if (kind === "BOAT") b = model;

  await OrdersRepo.setSelection(orderNo, v, b);

  // แจ้งในห้องให้ทุกคนเห็น
  const lines = [];
  lines.push(`✅ **เลือก Model แล้ว** (Order **${orderNo}**)`);
  lines.push(`- ${kind}: **${model}**`);

  const req = requirements(order);
  if (req.requireCar && !v) lines.push("⚠️ ยังไม่ได้เลือกรถ (CAR) กรุณาเลือกให้ครบ");
  if (req.requireBoat && !b) lines.push("⚠️ ยังไม่ได้เลือกเรือ (BOAT) กรุณาเลือกให้ครบ");

  // public reply in ticket channel
  return interaction.reply({ content: lines.join("\n") }).catch(() => {
    // fallback ephemeral (if already replied)
    return safeReply(interaction, { content: `✅ เลือกแล้ว: ${kind} = ${model}`, ephemeral: true });
  });
}
