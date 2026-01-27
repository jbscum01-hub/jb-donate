// src/discord/router.js
import { openOrderModal } from "./handlers/shop.select.js";
import { createOrderFromModal } from "./handlers/order.modal.js";
import { handleTicketVehicleSelect } from "./handlers/ticket.vehicle.select.js";

import { approveOrder } from "./handlers/staff.approve.js";
import { genCommands } from "./handlers/staff.gen.js";
import { setPlate } from "./handlers/staff.setPlate.js";
import { closeOrder } from "./handlers/staff.close.js";
import { cancelOrder } from "./handlers/staff.cancel.js";

import { useInsuranceFromCard } from "./handlers/vehicleCard.useIns.js";

export async function routeInteraction(interaction) {
  try {
    // Select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "shop_select") return openOrderModal(interaction);
      if (interaction.customId.startsWith("ticket_model_select:")) return handleTicketVehicleSelect(interaction);
      return;
    }

    // Modal submits
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("order_create:")) return createOrderFromModal(interaction);

      // plate modals
      if (interaction.customId.startsWith("set_plate_modal:")) return setPlate(interaction);

      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("staff_approve:")) return approveOrder(interaction);
      if (id.startsWith("staff_gen:")) return genCommands(interaction);

      // SET PLATE (new)
      if (id.startsWith("staff_set_car_plate:")) return setPlate(interaction);
      if (id.startsWith("staff_set_boat_plate:")) return setPlate(interaction);

      // SET PLATE (old fallback)
      if (id.startsWith("staff_set_plate:")) return setPlate(interaction);

      if (id.startsWith("staff_close:")) return closeOrder(interaction);
      if (id.startsWith("staff_cancel:")) return cancelOrder(interaction);

      if (id.startsWith("vehiclecard_useins:")) return useInsuranceFromCard(interaction);

      return;
    }
  } catch (err) {
    console.error("routeInteraction error:", err);
    // try not to crash
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ มีข้อผิดพลาด (ดู log)", ephemeral: true }).catch(() => {});
    }
  }
}
