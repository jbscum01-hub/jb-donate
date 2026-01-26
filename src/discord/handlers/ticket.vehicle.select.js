import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { safeReply } from "../utils/messages.js";

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

  return safeReply(interaction, { content: `✅ เลือกแล้ว: ${kind} = ${model}`, ephemeral: true });
}
