import { MessageFlags } from "discord.js";
import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { safeReply } from "../utils/messages.js";

async function requirements(order) {
  if (order.type !== "DONATE") return { requireCar: false, requireBoat: false };
  const p = await DonatePackRepo.getPackDetails(order.pack_code);
  const requireCar = (p?.vehicleChoices?.length ?? 0) > 0;
  const requireBoat = (p?.boatChoices?.length ?? 0) > 0;
  return { requireCar, requireBoat };
}

export async function handleTicketVehicleSelect(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  const orderNo = interaction.customId.split(":")[1];
  const [kind, model] = String(interaction.values?.[0] || "").split(":");

  if (!kind || !model) {
    return safeReply(interaction, { content: "❌ ค่า model ไม่ถูกต้อง", ephemeral: true });
  }

  const order = await OrdersRepo.getByNo(orderNo);
  if (!order) return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });

  if (order.status !== "PENDING") {
    return safeReply(interaction, { content: "❌ เปลี่ยน model ได้เฉพาะก่อน APPROVE เท่านั้น", ephemeral: true });
  }

  let v = order.selected_vehicle;
  let b = order.selected_boat;

  if (kind === "CAR") v = model;
  if (kind === "BOAT") b = model;

  await OrdersRepo.setSelection(orderNo, v, b);

  const lines = [];
  lines.push(`✅ **เลือก Model แล้ว** (Order **${orderNo}**)`);
  lines.push(`- ${kind}: **${model}**`);

  const req = await requirements(order);
  if (req.requireCar && !v) lines.push("⚠️ ยังไม่ได้เลือกรถ (CAR) กรุณาเลือกให้ครบ");
  if (req.requireBoat && !b) lines.push("⚠️ ยังไม่ได้เลือกเรือ (BOAT) กรุณาเลือกให้ครบ");

  return safeReply(interaction, { content: lines.join("
"), ephemeral: true });
}
