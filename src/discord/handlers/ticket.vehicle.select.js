import { OrdersRepo } from "../../db/repo/orders.repo.js";
import { DonatePackRepo } from "../../db/repo/donatePack.repo.js";
import { safeReply } from "../utils/messages.js";

async function requirements(order) {
  if (order.type !== "DONATE") {
    return { requireCar: false, requireBoat: false };
  }

  const pack = await DonatePackRepo.getPackDetails(order.pack_code);
  return {
    requireCar: (pack?.vehicleChoices?.length ?? 0) > 0,
    requireBoat: (pack?.boatChoices?.length ?? 0) > 0,
  };
}

export async function handleTicketVehicleSelect(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const orderNo = interaction.customId.split(":")[1];
    const rawValue = interaction.values?.[0];

    if (!orderNo) {
      return safeReply(interaction, { content: "❌ ไม่พบเลข Order", ephemeral: true });
    }

    if (!rawValue || !rawValue.includes(":")) {
      return safeReply(interaction, { content: "❌ ข้อมูล model ที่เลือกไม่ถูกต้อง", ephemeral: true });
    }

    const [kind, ...modelParts] = rawValue.split(":");
    const model = modelParts.join(":").trim();

    if (!kind || !model) {
      return safeReply(interaction, { content: "❌ ข้อมูล model ที่เลือกไม่ครบ", ephemeral: true });
    }

    const order = await OrdersRepo.getByNo(orderNo);
    if (!order) {
      return safeReply(interaction, { content: "❌ ไม่พบ Order", ephemeral: true });
    }

    if (order.status !== "PENDING") {
      return safeReply(interaction, {
        content: "❌ เปลี่ยน model ได้เฉพาะก่อน APPROVE เท่านั้น",
        ephemeral: true,
      });
    }

    const selectedVehicle = kind === "CAR" ? model : order.selected_vehicle;
    const selectedBoat = kind === "BOAT" ? model : order.selected_boat;

    await OrdersRepo.setSelection(orderNo, selectedVehicle, selectedBoat);

    const lines = [
      `✅ **เลือก Model แล้ว** (Order **${orderNo}**)`,
      `- ${kind}: **${model}**`,
    ];

    const req = await requirements(order);
    if (req.requireCar && !selectedVehicle) {
      lines.push("⚠️ ยังไม่ได้เลือกรถ (CAR) กรุณาเลือกให้ครบ");
    }
    if (req.requireBoat && !selectedBoat) {
      lines.push("⚠️ ยังไม่ได้เลือกเรือ (BOAT) กรุณาเลือกให้ครบ");
    }

    return safeReply(interaction, {
      content: lines.join("\n"),
      ephemeral: true,
    });
  } catch (error) {
    console.error("handleTicketVehicleSelect error", error);
    return safeReply(interaction, {
      content: `❌ เลือก model ไม่สำเร็จ: ${error?.message || String(error)}`,
      ephemeral: true,
    }).catch(() => {});
  }
}
