import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { safeReply } from "../utils/messages.js";

async function requirements(order) {
  if (order.type !== "DONATE") {
    return { requireCar: false, requireBoat: false };
  }

  const p = await DonatePackRepo.getPackDetails(order.pack_code);
  const requireCar = (p?.vehicleChoices?.length ?? 0) > 0;
  const requireBoat = (p?.boatChoices?.length ?? 0) > 0;

  return { requireCar, requireBoat };
}

export async function handleTicketVehicleSelect(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const orderNo = interaction.customId.split(":")[1];
    const rawValue = interaction.values?.[0];

    if (!orderNo) {
      return safeReply(interaction, {
        content: "❌ ไม่พบเลข Order",
      });
    }

    if (!rawValue || !rawValue.includes(":")) {
      return safeReply(interaction, {
        content: "❌ ข้อมูล model ที่เลือกไม่ถูกต้อง",
      });
    }

    const [kind, model] = rawValue.split(":");

    if (!kind || !model) {
      return safeReply(interaction, {
        content: "❌ ข้อมูล model ที่เลือกไม่ครบ",
      });
    }

    const order = await OrdersRepo.getByNo(orderNo);
    if (!order) {
      return safeReply(interaction, {
        content: "❌ ไม่พบ Order",
      });
    }

    if (order.status !== "PENDING") {
      return safeReply(interaction, {
        content: "❌ เปลี่ยน model ได้เฉพาะก่อน APPROVE เท่านั้น",
      });
    }

    let selectedVehicle = order.selected_vehicle;
    let selectedBoat = order.selected_boat;

    if (kind === "CAR") selectedVehicle = model;
    if (kind === "BOAT") selectedBoat = model;

    await OrdersRepo.setSelection(orderNo, selectedVehicle, selectedBoat);

    const lines = [];
    lines.push(`✅ **เลือก Model แล้ว** (Order **${orderNo}**)`);
    lines.push(`- ${kind}: **${model}**`);

    const req = await requirements(order);

    if (req.requireCar && !selectedVehicle) {
      lines.push("⚠️ ยังไม่ได้เลือกรถ (CAR) กรุณาเลือกให้ครบ");
    }

    if (req.requireBoat && !selectedBoat) {
      lines.push("⚠️ ยังไม่ได้เลือกเรือ (BOAT) กรุณาเลือกให้ครบ");
    }

    return safeReply(interaction, {
      content: lines.join("\n"),
    });
  } catch (error) {
    console.error("handleTicketVehicleSelect error", error);

    return safeReply(interaction, {
      content: `❌ เลือก model ไม่สำเร็จ: ${error?.message || String(error)}`,
    }).catch(() => {});
  }
}
