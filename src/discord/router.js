import { openOrderModal } from "./handlers/shop.select.js";
import { createOrderFromModal } from "./handlers/order.modal.js";
import { handleTicketVehicleSelect } from "./handlers/ticket.vehicle.select.js";
import { approveOrder } from "./handlers/staff.approve.js";
import { genTemplate } from "./handlers/staff.gen.js";
import { setPlate } from "./handlers/staff.setPlate.js";
import { closeOrder } from "./handlers/staff.close.js";
import { cancelOrder } from "./handlers/staff.cancel.js";
import { useInsuranceFromVehicleCard } from "./handlers/vehicleCard.useIns.js";

export async function routeInteraction(interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "shop_select") return openOrderModal(interaction);
      if (interaction.customId.startsWith("ticket_model_select:")) return handleTicketVehicleSelect(interaction);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("order_create:")) return createOrderFromModal(interaction);
      if (interaction.customId.startsWith("set_plate_modal:")) return setPlate(interaction);
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("staff_approve:")) return approveOrder(interaction);
      if (id.startsWith("staff_gen:")) return genTemplate(interaction);
      if (id.startsWith("staff_set_plate:")) return setPlate(interaction);
      if (id.startsWith("staff_close:")) return closeOrder(interaction);
      if (id.startsWith("staff_cancel:")) return cancelOrder(interaction);

      if (id.startsWith("vehiclecard_useins:")) return useInsuranceFromVehicleCard(interaction);
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: "❌ เกิดข้อผิดพลาดในระบบ", ephemeral: true });
    }
    return interaction.followUp({ content: "❌ เกิดข้อผิดพลาดในระบบ", ephemeral: true });
  }
}
